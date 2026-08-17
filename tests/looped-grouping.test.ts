import { describe, it, expect } from "vitest";
import { groupLooped } from "@/lib/looped";
import { relativeDayLabel } from "@/lib/dates";
import type { LoopedTask } from "@/lib/dal";

/**
 * How the Partner page arranges a fortnight of shared work.
 *
 * The repeating task is the whole reason this is not a sort: one row lands on
 * every day of the window, and the difference between "listed once at the top" and
 * "printed fourteen times" is the difference between a usable page and a wall.
 */

const TODAY = "2026-08-17";

function item(partial: Partial<LoopedTask["task"]> & { mine?: boolean } = {}): LoopedTask {
  const { mine = true, ...task } = partial;
  return {
    mine,
    task: {
      id: Math.random().toString(36).slice(2),
      user_id: mine ? "me" : "them",
      text: "Task",
      done: false,
      scheduled_on: TODAY,
      scheduled_time: null,
      duration_minutes: null,
      category: null,
      repeat_daily: false,
      kind: "general",
      shared_with_partner: true,
      created_at: "",
      ...task,
    },
  };
}

describe("groupLooped", () => {
  it("buckets one-offs under their own date", () => {
    const { days } = groupLooped(
      [
        item({ text: "Dentist", scheduled_on: "2026-08-20" }),
        item({ text: "Flights", scheduled_on: "2026-08-18" }),
      ],
      TODAY,
    );

    expect(days.map((d) => d.day)).toEqual(["2026-08-18", "2026-08-20"]);
    expect(days[0].items[0].task.text).toBe("Flights");
  });

  // Listed once, not once per day of the window.
  it("lifts an already-running repeat out of the days", () => {
    const { everyDay, days } = groupLooped(
      [item({ text: "Walk 7.5K", repeat_daily: true, scheduled_on: "2026-07-01" })],
      TODAY,
    );

    expect(everyDay.map((i) => i.task.text)).toEqual(["Walk 7.5K"]);
    expect(days).toEqual([]);
  });

  it("counts a repeat starting today as already running", () => {
    const { everyDay } = groupLooped(
      [item({ repeat_daily: true, scheduled_on: TODAY })],
      TODAY,
    );
    expect(everyDay).toHaveLength(1);
  });

  // A repeat that has not begun is not part of every day — it is something that
  // starts on a date, and that date is the useful thing to show.
  it("leaves a future repeat under its start date", () => {
    const { everyDay, days } = groupLooped(
      [item({ text: "New habit", repeat_daily: true, scheduled_on: "2026-08-24" })],
      TODAY,
    );

    expect(everyDay).toEqual([]);
    expect(days).toEqual([
      expect.objectContaining({ day: "2026-08-24" }),
    ]);
  });

  it("keeps both sides of the pair in the same day", () => {
    const { days } = groupLooped(
      [
        item({ text: "Mine", scheduled_on: "2026-08-19", mine: true }),
        item({ text: "Theirs", scheduled_on: "2026-08-19", mine: false }),
      ],
      TODAY,
    );

    expect(days).toHaveLength(1);
    expect(days[0].items.map((i) => i.mine)).toEqual([true, false]);
  });

  it("preserves the order within a day", () => {
    const { days } = groupLooped(
      [
        item({ text: "Morning", scheduled_on: "2026-08-19", scheduled_time: "07:00:00" }),
        item({ text: "Evening", scheduled_on: "2026-08-19", scheduled_time: "19:00:00" }),
      ],
      TODAY,
    );
    expect(days[0].items.map((i) => i.task.text)).toEqual(["Morning", "Evening"]);
  });

  it("has nothing to group when nothing is shared", () => {
    expect(groupLooped([], TODAY)).toEqual({ everyDay: [], days: [] });
  });
});

describe("relativeDayLabel", () => {
  it("names the near days instead of dating them", () => {
    expect(relativeDayLabel(TODAY, TODAY)).toBe("Today");
    expect(relativeDayLabel("2026-08-18", TODAY)).toBe("Tomorrow");
  });

  it("dates everything further out", () => {
    expect(relativeDayLabel("2026-08-24", TODAY)).toContain("August");
  });

  // Month and year ends are where naive date arithmetic breaks.
  it("crosses a month boundary", () => {
    expect(relativeDayLabel("2026-09-01", "2026-08-31")).toBe("Tomorrow");
  });
});
