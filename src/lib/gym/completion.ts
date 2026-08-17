/**
 * When a day's gym work counts as finished.
 *
 * Its own module because the rule has one non-obvious edge — an empty day is not
 * a finished day — and `[].every()` is `true`, so the naive version silently
 * marks a Fitness task done the moment you open it.
 */
export function isDayComplete(entries: { is_done: boolean }[]): boolean {
  return entries.length > 0 && entries.every((entry) => entry.is_done);
}
