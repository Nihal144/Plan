import { requireUser, getWeekCounts } from "@/lib/dal";
import {
  getCategories,
  getCategoryCounts,
  getGymDay,
  getPoolNames,
} from "@/lib/gym/queries";
import { toggleEntry, skipEntry, removeEntry } from "@/app/actions/gym";
import { today, isValidDay, weekOf } from "@/lib/dates";
import { isDayComplete } from "@/lib/gym/completion";
import type { WorkoutEntry } from "@/lib/gym/types";
import { WeekStrip } from "../week-strip";
import { ViewSwitcher } from "../view-switcher";
import { CategoryTabs } from "./category-tabs";
import { DayNote } from "./day-note";
import { AddEntry } from "./add-entry";

/**
 * Fitness > Gym: pick a training category, then log that category's work for the
 * selected day.
 *
 * Both the day and the category live in the URL (`?date=&cat=`), so the whole
 * view is one shareable, refreshable address and the tabs need no client state.
 */
export default async function FitnessPage({ searchParams }: PageProps<"/plan/fitness">) {
  await requireUser();
  const params = await searchParams;

  const todayStr = today();
  const rawDate = typeof params.date === "string" ? params.date : undefined;
  const selected = isValidDay(rawDate) ? rawDate : todayStr;

  const categories = await getCategories();

  // The pool is seeded by migration 0007. An empty list means it has not been
  // applied — say so rather than rendering seven missing tabs.
  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-8 px-6 py-8 lg:px-10 lg:py-9">
        <header>
          <ViewSwitcher current="/plan/fitness" date={selected} />
        </header>
        <div className="rounded-2xl border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-700">
          <p className="font-medium text-zinc-500 dark:text-zinc-400">
            No training categories yet.
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Run <code className="font-mono">0007_gym.sql</code> in the Supabase SQL
            Editor to seed them.
          </p>
        </div>
      </div>
    );
  }

  const rawCat = typeof params.cat === "string" ? params.cat : undefined;
  const category = categories.find((c) => c.slug === rawCat) ?? categories[0];

  const week = weekOf(selected);
  const [day, poolNames, catCounts, weekCounts] = await Promise.all([
    getGymDay(category, selected),
    getPoolNames(category.id),
    getCategoryCounts(selected),
    getWeekCounts(week[0], week[6], "fitness"),
  ]);

  // getCategoryCounts is keyed by id; the tabs think in slugs.
  const countsBySlug: Record<string, { done: number; total: number }> = {};
  for (const c of categories) {
    const count = catCounts[c.id];
    if (count) countsBySlug[c.slug] = count;
  }

  const doneCount = day.entries.filter((e) => e.is_done).length;
  // The same rule the server uses to tick the Fitness task, so the banner and
  // the dashboard can never disagree about whether the day is finished.
  const allDone = isDayComplete(day.entries);

  return (
    <div className="flex flex-col gap-8 px-6 py-8 lg:px-10 lg:py-9">
      <header>
        <ViewSwitcher current="/plan/fitness" date={selected} />
      </header>

      <div className="flex flex-col gap-6">
        <WeekStrip
          selected={selected}
          todayStr={todayStr}
          counts={weekCounts}
          basePath="/plan/fitness"
          extraQuery={`&cat=${category.slug}`}
        />

        <CategoryTabs
          categories={categories}
          selectedSlug={category.slug}
          date={selected}
          counts={countsBySlug}
        />

        <section
          role="tabpanel"
          aria-label={category.name}
          className="flex flex-col gap-5 rounded-2xl border border-orange-200 p-4 dark:border-orange-500/30 lg:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-orange-900 dark:text-orange-200">
              {category.name}
            </h2>
            {day.entries.length > 0 && (
              <span className="rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold tabular-nums text-white dark:bg-orange-500">
                {doneCount}/{day.entries.length} done
              </span>
            )}
          </div>

          {allDone && (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckIcon />
              Everything done for {category.name} today.
            </p>
          )}

          {day.entries.length === 0 ? (
            <p className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
              Nothing logged for {category.name} yet. Add your first exercise below.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {day.entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} date={selected} />
              ))}
            </div>
          )}

          <AddEntry categoryId={category.id} date={selected} suggestions={poolNames} />

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Keyed so switching tab or day remounts with that day's note,
              rather than syncing the prop into state with an effect. */}
          <DayNote
            key={`${category.id}-${selected}`}
            categoryId={category.id}
            date={selected}
            note={day.dayNote}
          />
        </section>
      </div>
    </div>
  );
}

/**
 * Same anatomy as a task card: the name on the left, the actions on the right,
 * revealed on hover. No control sits before the text.
 */
function EntryRow({ entry, date }: { entry: WorkoutEntry; date: string }) {
  const tone = entry.is_done
    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10"
    : entry.skipped
      ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/40"
      : "border-zinc-200 dark:border-zinc-800";

  return (
    <div className={`group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${tone}`}>
      <p
        className={`flex min-w-0 flex-1 items-center gap-2 text-sm font-medium ${
          entry.is_done
            ? "text-emerald-800 dark:text-emerald-200/80"
            : entry.skipped
              ? "text-zinc-400 dark:text-zinc-500"
              : ""
        }`}
      >
        {entry.is_done && <CircleCheck />}
        <span className="min-w-0 [overflow-wrap:anywhere]">{entry.exercise_name}</span>
      </p>

      <div className="flex shrink-0 items-center gap-1">
        {/* State is never carried by colour alone — each has a text label. */}
        {entry.is_done && <StateBadge tone="done">Done</StateBadge>}
        {entry.skipped && <StateBadge tone="skipped">Skipped</StateBadge>}

        <div
          className={`flex items-center gap-1 transition-opacity max-sm:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 ${
            entry.is_done || entry.skipped ? "opacity-100" : "opacity-0"
          }`}
        >
          <form action={toggleEntry} className="flex">
            <input type="hidden" name="id" value={entry.id} />
            {/* Current state, not the target — the action inverts it. */}
            <input type="hidden" name="done" value={String(entry.is_done)} />
            {/* Which day's Fitness task to re-derive after the write. */}
            <input type="hidden" name="date" value={date} />
            <button
              type="submit"
              aria-label={`Mark “${entry.exercise_name}” as ${entry.is_done ? "not done" : "done"}`}
              title={entry.is_done ? "Undo" : "Mark as done"}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                entry.is_done
                  ? "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                  : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
              }`}
            >
              {entry.is_done ? <UndoIcon /> : <CheckIcon />}
            </button>
          </form>

          <form action={skipEntry} className="flex">
            <input type="hidden" name="id" value={entry.id} />
            <input type="hidden" name="skipped" value={String(entry.skipped)} />
            <input type="hidden" name="date" value={date} />
            <button
              type="submit"
              aria-label={`${entry.skipped ? "Un-skip" : "Skip"} “${entry.exercise_name}”`}
              title={entry.skipped ? "Un-skip" : "Skip today"}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-orange-50 hover:text-orange-700 dark:text-zinc-500 dark:hover:bg-orange-500/15 dark:hover:text-orange-300"
            >
              <SkipIcon />
              <span className="hidden sm:inline">{entry.skipped ? "Un-skip" : "Skip"}</span>
            </button>
          </form>

          <form action={removeEntry} className="flex">
            <input type="hidden" name="id" value={entry.id} />
            <input type="hidden" name="date" value={date} />
            <button
              type="submit"
              aria-label={`Remove “${entry.exercise_name}”`}
              title="Remove"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function StateBadge({ tone, children }: { tone: "done" | "skipped"; children: string }) {
  return (
    <span
      className={`hidden rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline ${
        tone === "done"
          ? "bg-emerald-600 text-white dark:bg-emerald-500"
          : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
      }`}
    >
      {children}
    </span>
  );
}

/** lucide `circle-check`, inlined to match the task cards. */
function CircleCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** lucide `skip-forward`. */
function SkipIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4l10 8-10 8V4z" />
      <path d="M19 5v14" />
    </svg>
  );
}

/** lucide `rotate-ccw`. */
function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 6.2l2.6 2.6L10 3.4" />
    </svg>
  );
}
