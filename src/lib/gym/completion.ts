export type CompletionEntry = { is_done: boolean; skipped?: boolean };

/**
 * When a day's gym work counts as finished.
 *
 * Two non-obvious edges, which is why this is its own tested module:
 *
 *   - An empty day is not a finished day. `[].every()` is `true`, so the naive
 *     version marks a Fitness task done the moment you open a blank day.
 *   - A skipped exercise is resolved, not outstanding, so it must not hold the
 *     day open. But a day of nothing *but* skips is not a workout either — at
 *     least one exercise has to have actually been done.
 */
export function isDayComplete(entries: CompletionEntry[]): boolean {
  const outstanding = entries.some((entry) => !entry.is_done && !entry.skipped);
  const anyDone = entries.some((entry) => entry.is_done);
  return anyDone && !outstanding;
}
