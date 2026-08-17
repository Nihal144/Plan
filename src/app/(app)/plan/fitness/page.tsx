import { requireUser, getWeekCounts } from "@/lib/dal";
import {
  getCategories,
  getCategoryCounts,
  getGymDay,
  getPoolNames,
} from "@/lib/gym/queries";
import { toggleEntry, removeEntry } from "@/app/actions/gym";
import { today, isValidDay, weekOf } from "@/lib/dates";
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
  const allDone = day.entries.length > 0 && doneCount === day.entries.length;

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

function EntryRow({ entry, date }: { entry: WorkoutEntry; date: string }) {
  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        entry.is_done
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10"
          : "border-zinc-200 dark:border-zinc-800"
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
          role="checkbox"
          aria-checked={entry.is_done}
          aria-label={`Mark “${entry.exercise_name}” as ${entry.is_done ? "not done" : "done"}`}
          className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${
            entry.is_done
              ? "border-emerald-500 bg-emerald-600 text-white dark:border-emerald-500/50 dark:bg-emerald-500"
              : "border-zinc-300 hover:border-emerald-500 dark:border-zinc-600"
          }`}
        >
          {entry.is_done && <CheckIcon />}
        </button>
      </form>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-medium [overflow-wrap:anywhere] ${
            entry.is_done ? "text-emerald-800 line-through dark:text-emerald-200/70" : ""
          }`}
        >
          {entry.exercise_name}
        </span>
        {/* Completion is never signalled by colour alone. */}
        {entry.is_done && (
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Done
          </span>
        )}
      </span>

      <form action={removeEntry} className="flex">
        <input type="hidden" name="id" value={entry.id} />
        <input type="hidden" name="date" value={date} />
        <button
          type="submit"
          aria-label={`Remove “${entry.exercise_name}”`}
          title="Remove"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 max-sm:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-red-950"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 6.2l2.6 2.6L10 3.4" />
    </svg>
  );
}
