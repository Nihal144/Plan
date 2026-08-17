import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Category, WorkoutEntry } from "./types";

/**
 * Gym reads. Same posture as `src/lib/dal.ts`: RLS is the boundary, so the
 * per-user queries carry no user_id filter, and every failure is logged rather
 * than collapsing into a calm empty state.
 */

function logQueryError(where: string, error: { message: string; code?: string }) {
  console.error(`[gym:${where}] ${error.code ?? "error"}: ${error.message}`);
}

/** The seven categories, in their fixed order. Global reference data. */
export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();

  const result = await supabase
    .from("gym_categories")
    .select("id, name, slug, icon, sort_order")
    .order("sort_order", { ascending: true });

  if (result.error) logQueryError("getCategories", result.error);

  return (result.data ?? []) as Category[];
});

/** Pool exercise names for one category, for the add-field's autocomplete. */
export const getPoolNames = cache(async (categoryId: string): Promise<string[]> => {
  const supabase = await createClient();

  const result = await supabase
    .from("gym_exercise_pool")
    .select("name")
    .eq("category_id", categoryId)
    .order("name", { ascending: true });

  if (result.error) logQueryError("getPoolNames", result.error);

  return ((result.data ?? []) as { name: string }[]).map((r) => r.name);
});

/**
 * done/total per category for one date, so each tab can show its progress.
 * One query for the whole strip rather than seven.
 */
export const getCategoryCounts = cache(
  async (date: string): Promise<Record<string, { done: number; total: number }>> => {
    const supabase = await createClient();

    const result = await supabase
      .from("workout_days")
      .select("category_id, workout_entries(is_done)")
      .eq("date", date);

    if (result.error) logQueryError("getCategoryCounts", result.error);

    const rows = (result.data ?? []) as {
      category_id: string;
      workout_entries: { is_done: boolean }[];
    }[];

    const counts: Record<string, { done: number; total: number }> = {};
    for (const row of rows) {
      const entries = row.workout_entries ?? [];
      counts[row.category_id] = {
        total: entries.length,
        done: entries.filter((e) => e.is_done).length,
      };
    }
    return counts;
  },
);

export type GymDay = {
  category: Category;
  /** Null until the user first interacts — the day row is created lazily. */
  dayId: string | null;
  dayNote: string;
  entries: WorkoutEntry[];
  /**
   * Why the entries could not be read, if they could not be.
   *
   * Carried out of the query rather than only logged, because the two states are
   * indistinguishable in the UI: a failed read and an empty day both render as
   * "nothing logged yet". That cost a day of confusion when 0008 had not been
   * applied — the tab counter said 1/2 while the panel said the day was empty,
   * because the counter does not select the column the migration adds.
   */
  entriesError: string | null;
};

// One literal, not a concatenation: supabase-js parses the select string at the
// type level, and a built-up `string` defeats that and infers an error type.
const ENTRY_COLUMNS =
  "id, workout_day_id, user_id, exercise_name, source, sets, reps, weight, duration, distance, note, is_done, skipped, completed_at, sort_order, created_at";

/**
 * One category's log for one date.
 *
 * Read-only: it never creates the workout_day. Opening a tab should not write,
 * or simply browsing the week would litter the table with empty days.
 */
export const getGymDay = cache(
  async (category: Category, date: string): Promise<GymDay> => {
    const supabase = await createClient();

    const day = await supabase
      .from("workout_days")
      .select("id, day_note")
      .eq("category_id", category.id)
      .eq("date", date)
      .maybeSingle();

    if (day.error) logQueryError("getGymDay", day.error);

    const row = day.data as { id: string; day_note: string | null } | null;
    if (!row) {
      return {
        category,
        dayId: null,
        dayNote: "",
        entries: [],
        // A day row that does not exist yet is a genuinely empty day, not a
        // failure — but a day row that could not be *read* is.
        entriesError: day.error?.message ?? null,
      };
    }

    const entries = await supabase
      .from("workout_entries")
      .select(ENTRY_COLUMNS)
      .eq("workout_day_id", row.id)
      // Outstanding first, then skipped, then finished — resolved work sinks
      // below whatever is still to do.
      .order("is_done", { ascending: true })
      .order("skipped", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (entries.error) logQueryError("getGymDay/entries", entries.error);

    return {
      category,
      dayId: row.id,
      dayNote: row.day_note ?? "",
      entries: (entries.data ?? []) as WorkoutEntry[],
      entriesError: entries.error?.message ?? null,
    };
  },
);
