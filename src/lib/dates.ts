/**
 * Date helpers for the planner.
 *
 * Everything here works on `YYYY-MM-DD` strings rather than Date objects with
 * times attached. A planner day is a calendar day, and formatting a Date back to
 * a local ISO date is where off-by-one-day bugs come from (`toISOString()` shifts
 * to UTC and can land on the previous day for anyone west of Greenwich).
 */

/** Local calendar date as YYYY-MM-DD — never `toISOString().slice(0, 10)`. */
export function toDayString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toDayString(new Date());
}

/** Parsed as local midnight; `new Date("2026-08-15")` would parse as UTC. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDayString(d);
}

/** Monday-first week containing `day`. */
export function weekOf(day: string): string[] {
  const d = parseDay(day);
  const dow = (d.getDay() + 6) % 7; // Sunday = 0 -> 6
  const monday = addDays(day, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function isValidDay(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekdayLabel(day: string): string {
  return WEEKDAYS[(parseDay(day).getDay() + 6) % 7];
}

export function dayOfMonth(day: string): number {
  return parseDay(day).getDate();
}

export function monthLabel(day: string): string {
  return parseDay(day).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function longDayLabel(day: string): string {
  return parseDay(day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** "14:30:00" -> "02:30 PM". Returns null for untimed tasks. */
export function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * "Today", "Tomorrow", or the full date.
 *
 * A list spanning a fortnight needs the near days named rather than dated —
 * "Monday, August 17" makes you work out whether that is now.
 */
export function relativeDayLabel(day: string, todayStr: string): string {
  if (day === todayStr) return "Today";
  if (day === addDays(todayStr, 1)) return "Tomorrow";
  return longDayLabel(day);
}

/**
 * "22:10:00" -> "22:10". The timeline gutter is a narrow column of times read as
 * a column, where 24h keeps every row the same width and sorts visually; the
 * 12h form stays on the cards, where it is read as prose.
 */
export function formatClock(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

/** 80 -> "1 hr 20 mins". Returns null when a task has no duration set. */
export function formatDuration(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts: string[] = [];

  if (hours) parts.push(`${hours} ${hours === 1 ? "hr" : "hrs"}`);
  // Not "1 hr 0 mins": the zero part is dropped rather than padded.
  if (mins) parts.push(`${mins} ${mins === 1 ? "min" : "mins"}`);

  return parts.join(" ");
}

export type Period = "morning" | "afternoon" | "evening" | "anytime";

export const PERIOD_LABELS: Record<Period, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  anytime: "Anytime",
};

export const PERIOD_ORDER: Period[] = ["morning", "afternoon", "evening", "anytime"];

export function periodOf(time: string | null): Period {
  if (!time) return "anytime";
  const hour = Number(time.split(":")[0]);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
