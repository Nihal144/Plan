import type { LoopedTask } from "@/lib/dal";

/**
 * How the Partner page arranges the next two weeks of looped-in work.
 *
 * The whole job is the repeating task. A repeat is one row that lands on every
 * day from its start date onward, so a naive expansion across a fourteen-day
 * window prints "Walk 7.5K" fourteen times and buries everything that only
 * happens once. It gets its own group at the top instead, listed once.
 *
 * A repeat that has not started yet is different: it is not part of every day, it
 * is something that begins on a date. So it sits under that date, where its Daily
 * badge says the rest.
 *
 * Pure and separate from the page so these two cases can be pinned in tests.
 */

export type LoopedDay = { day: string; items: LoopedTask[] };

export type GroupedLooped = {
  /** Repeats already under way — every day of the window, so listed once. */
  everyDay: LoopedTask[];
  /** One-offs, and repeats that start later, under the date they land on. */
  days: LoopedDay[];
};

export function groupLooped(items: LoopedTask[], todayStr: string): GroupedLooped {
  const everyDay: LoopedTask[] = [];
  const byDay = new Map<string, LoopedTask[]>();

  for (const item of items) {
    const { repeat_daily, scheduled_on } = item.task;

    if (repeat_daily && scheduled_on <= todayStr) {
      everyDay.push(item);
      continue;
    }

    const bucket = byDay.get(scheduled_on);
    if (bucket) bucket.push(item);
    else byDay.set(scheduled_on, [item]);
  }

  // Sorted here rather than trusted from the query: grouping is where the order
  // would silently break, and an out-of-order fortnight is hard to spot.
  const days = [...byDay.entries()]
    .map(([day, dayItems]) => ({ day, items: dayItems }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return { everyDay, days };
}
