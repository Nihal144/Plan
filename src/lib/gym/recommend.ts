import type { PoolExercise } from "./types";

/**
 * The recommendation engine.
 *
 * A pure function with no database, no clock and no randomness — every input is
 * an argument. That is what makes the rules testable, and it is why the caller
 * does the querying and hands the results in.
 */

/** How many slots the day view offers. */
export const RECOMMENDATION_COUNT = 4;

/** How many past sessions count as "recent" for the purpose of not repeating. */
export const SESSION_LOOKBACK = 2;

export type PastSession = {
  /** YYYY-MM-DD. */
  date: string;
  exerciseNames: string[];
};

export type RecommendationInput = {
  userId: string;
  categoryId: string;
  /** YYYY-MM-DD — the day being recommended for. */
  date: string;
  /** The category's full exercise pool. */
  pool: PoolExercise[];
  /**
   * Every past session for this category. The engine picks the most recent
   * `SESSION_LOOKBACK` of them itself, so the caller does not have to encode
   * that rule in a query.
   */
  history?: PastSession[];
  /** Names already added or dismissed for this day. */
  excluded?: string[];
};

/**
 * Exercise names are compared case- and whitespace-insensitively.
 *
 * A manual entry typed as "push up" and the pool's "Push-Up" are the same
 * exercise to a human, and recommending back something the user just logged is
 * the exact failure this guards against. Punctuation is stripped for the same
 * reason.
 */
function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * FNV-1a. Any stable hash would do; what matters is that it depends only on its
 * input, so the same (user, category, date, exercise) always sorts the same way.
 * `Math.random()` or anything clock-derived would break the refresh guarantee.
 */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A stable shuffle: order the pool by a hash of the exercise seeded with the
 * (user, category, date) triple. Different users get different suggestions on the
 * same day, the same user gets different suggestions tomorrow, and refreshing
 * changes nothing.
 */
function seededOrder(
  exercises: PoolExercise[],
  userId: string,
  categoryId: string,
  date: string,
): PoolExercise[] {
  const seed = `${userId}|${categoryId}|${date}`;
  return [...exercises].sort((a, b) => {
    const ha = hash32(`${seed}|${a.name}`);
    const hb = hash32(`${seed}|${b.name}`);
    // Name breaks ties, so the result never depends on the input array's order.
    return ha === hb ? a.name.localeCompare(b.name) : ha - hb;
  });
}

/** The names logged across the most recent `SESSION_LOOKBACK` sessions before `date`. */
function recentlyLogged(history: PastSession[], date: string): Set<string> {
  const recent = history
    .filter((session) => session.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, SESSION_LOOKBACK);

  return new Set(recent.flatMap((s) => s.exerciseNames).map(normalise));
}

/**
 * Up to four exercises to suggest for one (user, category, day).
 *
 * Precedence, highest first:
 *   1. Never suggest something already added or dismissed today — a hard filter.
 *      Dismissing is only for today, so it does not touch the pool or later days.
 *   2. Prefer exercises absent from the last two sessions, for variety.
 *   3. Only if that leaves fewer than four, fill the rest from the recent ones —
 *      a small pool should still produce a full day.
 *   4. Never repeat an exercise; return fewer than four instead.
 */
export function getRecommendations(input: RecommendationInput): PoolExercise[] {
  const { userId, categoryId, date, pool, history = [], excluded = [] } = input;

  const excludedNames = new Set(excluded.map(normalise));
  const candidates = pool.filter((e) => !excludedNames.has(normalise(e.name)));

  // Deduplicate by normalised name so a pool containing both "Push-Up" and
  // "Push Up" cannot fill two of the four slots with the same movement.
  const seen = new Set<string>();
  const unique = candidates.filter((e) => {
    const key = normalise(e.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const ordered = seededOrder(unique, userId, categoryId, date);
  const recent = recentlyLogged(history, date);

  const fresh: PoolExercise[] = [];
  const fallback: PoolExercise[] = [];
  for (const exercise of ordered) {
    (recent.has(normalise(exercise.name)) ? fallback : fresh).push(exercise);
  }

  // Fresh first, then the recent ones only to top up a short list.
  return [...fresh, ...fallback].slice(0, RECOMMENDATION_COUNT);
}
