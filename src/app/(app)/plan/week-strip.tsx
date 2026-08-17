import Link from "next/link";
import { weekOf, weekdayLabel, dayOfMonth, addDays, monthLabel } from "@/lib/dates";

type Counts = Record<string, { total: number; done: number }>;

/**
 * The week containing `selected`, Monday-first. Each day links to itself, so the
 * strip works without JavaScript and every day is a shareable URL.
 *
 * `basePath` is which view the links stay in — Tasks and Fitness share this strip,
 * and each must keep you where you are while changing the day.
 */
export function WeekStrip({
  selected,
  todayStr,
  counts,
  basePath,
  extraQuery = "",
}: {
  selected: string;
  todayStr: string;
  counts: Counts;
  basePath: string;
  /** Appended to every link, e.g. "&cat=push", so changing the day keeps the tab. */
  extraQuery?: string;
}) {
  const days = weekOf(selected);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {monthLabel(selected)}
        </p>
        <div className="flex items-center gap-1">
          <Link
            href={`${basePath}?date=${addDays(selected, -7)}${extraQuery}`}
            aria-label="Previous week"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <Chevron dir="left" />
          </Link>
          <Link
            href={`${basePath}?date=${todayStr}${extraQuery}`}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            Today
          </Link>
          <Link
            href={`${basePath}?date=${addDays(selected, 7)}${extraQuery}`}
            aria-label="Next week"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <Chevron dir="right" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 rounded-2xl bg-zinc-100/80 p-2 dark:bg-zinc-800/50">
        {days.map((day) => {
          const isSelected = day === selected;
          const isToday = day === todayStr;
          const count = counts[day];
          const allDone = count && count.done === count.total;

          return (
            <Link
              key={day}
              href={`${basePath}?date=${day}${extraQuery}`}
              aria-current={isSelected ? "date" : undefined}
              className={`flex flex-col items-center gap-1 rounded-xl px-1 py-3 transition-colors ${
                isSelected
                  ? "bg-[#fdf5cf] dark:bg-[#3a3413]"
                  : "hover:bg-white dark:hover:bg-zinc-800"
              }`}
            >
              <span
                className={`text-xs font-medium ${
                  isSelected
                    ? "text-[#8a6d10] dark:text-[#e3cd6a]"
                    : isToday
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {weekdayLabel(day)}
              </span>
              <span
                className={`text-xl font-semibold tabular-nums ${
                  isSelected ? "text-[#6f5709] dark:text-[#f0dc86]" : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {dayOfMonth(day)}
              </span>
              {/* A dot only where work exists; hollow once the day is cleared. */}
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  !count
                    ? "bg-transparent"
                    : allDone
                      ? "bg-emerald-500/40"
                      : "bg-violet-500"
                }`}
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
