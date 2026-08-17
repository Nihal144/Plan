import Link from "next/link";
import type { Category } from "@/lib/gym/types";

/**
 * The seven training categories as tabs.
 *
 * Links rather than client state, so the selected tab is in the URL: it survives
 * a refresh, it is shareable, and it works without JavaScript — the same reason
 * the week strip is built from links.
 */
export function CategoryTabs({
  categories,
  selectedSlug,
  date,
  counts,
}: {
  categories: Category[];
  selectedSlug: string;
  date: string;
  /** slug -> { done, total } for this date, where a workout day exists. */
  counts: Record<string, { done: number; total: number }>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Training category"
      // Horizontal scroll rather than wrapping: seven tabs do not fit a phone,
      // and a wrapped second row reads as a separate control.
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categories.map((category) => {
        const active = category.slug === selectedSlug;
        const count = counts[category.slug];

        return (
          <Link
            key={category.id}
            href={`/plan/fitness?date=${date}&cat=${category.slug}`}
            role="tab"
            aria-selected={active}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
              active
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-zinc-200 text-zinc-600 hover:border-orange-300 hover:text-orange-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-500/50"
            }`}
          >
            {category.name}
            {count && count.total > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                  active
                    ? "bg-white/25"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {count.done}/{count.total}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
