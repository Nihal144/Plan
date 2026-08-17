import { describe, it, expect } from "vitest";
import {
  getRecommendations,
  RECOMMENDATION_COUNT,
  SESSION_LOOKBACK,
  type PastSession,
} from "@/lib/gym/recommend";
import type { PoolExercise } from "@/lib/gym/types";

const CATEGORY = "cat-push";

function pool(...names: string[]): PoolExercise[] {
  return names.map((name, i) => ({
    id: `ex-${i}`,
    category_id: CATEGORY,
    name,
    default_sets: 3,
    default_reps: 10,
    metric_type: "reps_weight" as const,
  }));
}

const BIG_POOL = pool(
  "Barbell Bench Press",
  "Incline Dumbbell Press",
  "Machine Chest Press",
  "Push-Up",
  "Cable Chest Fly",
  "Dips",
  "Close-Grip Bench Press",
  "Triceps Pushdown",
  "Skull Crusher",
  "Decline Bench Press",
);

const base = {
  userId: "user-1",
  categoryId: CATEGORY,
  date: "2026-08-17",
  pool: BIG_POOL,
};

const names = (list: PoolExercise[]) => list.map((e) => e.name);

describe("getRecommendations", () => {
  describe("determinism", () => {
    it("returns the same four for repeated calls", () => {
      const a = getRecommendations(base);
      const b = getRecommendations(base);
      const c = getRecommendations(base);

      expect(a).toHaveLength(RECOMMENDATION_COUNT);
      expect(names(b)).toEqual(names(a));
      expect(names(c)).toEqual(names(a));
    });

    it("does not depend on the order the pool arrives in", () => {
      const shuffled = [...BIG_POOL].reverse();
      expect(names(getRecommendations({ ...base, pool: shuffled }))).toEqual(
        names(getRecommendations(base)),
      );
    });

    it("gives different users different suggestions", () => {
      const a = names(getRecommendations(base));
      const b = names(getRecommendations({ ...base, userId: "user-2" }));
      expect(b).not.toEqual(a);
    });

    it("gives the same user different suggestions on a different day", () => {
      const a = names(getRecommendations(base));
      const b = names(getRecommendations({ ...base, date: "2026-08-18" }));
      expect(b).not.toEqual(a);
    });

    it("gives different categories different suggestions", () => {
      const a = names(getRecommendations(base));
      const b = names(getRecommendations({ ...base, categoryId: "cat-pull" }));
      expect(b).not.toEqual(a);
    });
  });

  describe("recent-exercise exclusion", () => {
    const history: PastSession[] = [
      { date: "2026-08-16", exerciseNames: ["Push-Up", "Dips"] },
      { date: "2026-08-15", exerciseNames: ["Barbell Bench Press", "Cable Chest Fly"] },
    ];

    it("skips everything from the last two sessions", () => {
      const result = names(getRecommendations({ ...base, history }));

      expect(result).toHaveLength(RECOMMENDATION_COUNT);
      for (const recent of ["Push-Up", "Dips", "Barbell Bench Press", "Cable Chest Fly"]) {
        expect(result).not.toContain(recent);
      }
    });

    it("looks back exactly two sessions, not three", () => {
      const withOlder: PastSession[] = [
        ...history,
        { date: "2026-08-14", exerciseNames: ["Skull Crusher"] },
      ];
      expect(SESSION_LOOKBACK).toBe(2);

      // The third-oldest session is out of range, so its exercise is fair game
      // again — proven by removing enough of the pool that it must be picked.
      const narrowed = BIG_POOL.filter((e) =>
        [
          "Skull Crusher",
          "Push-Up",
          "Dips",
          "Barbell Bench Press",
          "Cable Chest Fly",
        ].includes(e.name),
      );

      const result = names(
        getRecommendations({ ...base, pool: narrowed, history: withOlder }),
      );
      expect(result[0]).toBe("Skull Crusher");
    });

    it("ignores sessions on or after the day being recommended", () => {
      const future: PastSession[] = [
        { date: "2026-08-17", exerciseNames: ["Push-Up"] },
        { date: "2026-08-20", exerciseNames: ["Dips"] },
      ];
      const narrowed = BIG_POOL.filter((e) => ["Push-Up", "Dips"].includes(e.name));

      // Neither session is in the past relative to 2026-08-17, so neither
      // suppresses anything.
      expect(
        getRecommendations({ ...base, pool: narrowed, history: future }),
      ).toHaveLength(2);
    });

    it("matches names case- and punctuation-insensitively", () => {
      const narrowed = pool("Push-Up", "Dips");
      const result = getRecommendations({
        ...base,
        pool: narrowed,
        history: [{ date: "2026-08-16", exerciseNames: ["push up"] }],
      });

      // "push up" suppresses "Push-Up", so Dips must come first.
      expect(result[0].name).toBe("Dips");
    });
  });

  describe("already added or dismissed today", () => {
    it("never returns an excluded exercise", () => {
      const excluded = ["Push-Up", "Dips", "Skull Crusher"];
      const result = names(getRecommendations({ ...base, excluded }));

      for (const name of excluded) expect(result).not.toContain(name);
      expect(result).toHaveLength(RECOMMENDATION_COUNT);
    });

    it("outranks the small-pool fallback — exclusion is absolute", () => {
      const narrowed = pool("Push-Up", "Dips", "Skull Crusher");
      const result = getRecommendations({
        ...base,
        pool: narrowed,
        excluded: ["Push-Up", "Dips"],
        // Even with the remaining exercise logged recently, it is the only one
        // left; the two excluded ones must not be revived to pad the list.
        history: [{ date: "2026-08-16", exerciseNames: ["Skull Crusher"] }],
      });

      expect(names(result)).toEqual(["Skull Crusher"]);
    });
  });

  describe("small-pool fallback", () => {
    it("reuses recent exercises rather than returning a short list", () => {
      const narrowed = pool("A", "B", "C", "D", "E");
      const result = getRecommendations({
        ...base,
        pool: narrowed,
        history: [{ date: "2026-08-16", exerciseNames: ["A", "B", "C"] }],
      });

      // Only D and E are fresh, so two recent ones top the list back up to four.
      expect(result).toHaveLength(RECOMMENDATION_COUNT);
      expect(names(result)).toContain("D");
      expect(names(result)).toContain("E");
    });

    it("puts fresh exercises ahead of recycled ones", () => {
      const narrowed = pool("A", "B", "C", "D", "E");
      const result = names(
        getRecommendations({
          ...base,
          pool: narrowed,
          history: [{ date: "2026-08-16", exerciseNames: ["A", "B", "C"] }],
        }),
      );

      expect(result.slice(0, 2).sort()).toEqual(["D", "E"]);
    });

    it("returns fewer than four rather than repeating", () => {
      const result = getRecommendations({ ...base, pool: pool("A", "B") });

      expect(result).toHaveLength(2);
      expect(new Set(names(result)).size).toBe(2);
    });

    it("returns nothing for an empty pool", () => {
      expect(getRecommendations({ ...base, pool: [] })).toEqual([]);
    });

    it("returns nothing when everything is excluded", () => {
      const narrowed = pool("A", "B");
      expect(
        getRecommendations({ ...base, pool: narrowed, excluded: ["A", "B"] }),
      ).toEqual([]);
    });
  });

  describe("no repeats", () => {
    it("collapses duplicate names in the pool", () => {
      const dupes = pool("Push-Up", "push up", "PUSH-UP", "Dips", "Skull Crusher");
      const result = getRecommendations({ ...base, pool: dupes });

      const normalised = names(result).map((n) => n.toLowerCase().replace(/[^a-z0-9]/g, ""));
      expect(new Set(normalised).size).toBe(normalised.length);
      expect(result).toHaveLength(3);
    });

    it("never returns the same exercise twice, even on the fallback path", () => {
      const narrowed = pool("A", "B", "C");
      const result = getRecommendations({
        ...base,
        pool: narrowed,
        history: [
          { date: "2026-08-16", exerciseNames: ["A", "B", "C"] },
          { date: "2026-08-15", exerciseNames: ["A", "B", "C"] },
        ],
      });

      expect(result).toHaveLength(3);
      expect(new Set(names(result)).size).toBe(3);
    });
  });
});
