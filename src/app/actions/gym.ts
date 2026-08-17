"use server";

import { revalidatePath } from "next/cache";
import { requireUser, dayFilter } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { isValidDay } from "@/lib/dates";
import { isDayComplete } from "@/lib/gym/completion";

/**
 * Gym mutations.
 *
 * Every one is idempotent and safe to retry: the day row is fetched through
 * get_or_create_workout_day() (a single upsert on the (user, category, date)
 * key), and adding an exercise relies on the unique (workout_day_id,
 * exercise_name) constraint rather than a read-then-write.
 */

export type GymFormState = { error?: string; ok?: boolean };

function revalidate() {
  revalidatePath("/plan/fitness");
  // Gym work drives the Fitness task's tick, so the dashboards move with it.
  revalidatePath("/plan/tasks");
  revalidatePath("/home");
}

/**
 * Ticks the day's Fitness task(s) when every logged exercise is done, and unticks
 * them the moment that stops being true.
 *
 * Completion is derived from the whole day, not one category: a "Gym" task is
 * finished when there is nothing left outstanding, whichever tabs the work sits
 * under. An empty day is not a finished day — zero entries means not done, so
 * removing the last exercise unticks the task rather than declaring victory.
 *
 * Idempotent by construction: it recomputes from the entries every time rather
 * than toggling, so running it twice lands on the same answer.
 */
async function syncFitnessTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  date: string,
) {
  const { data, error } = await supabase
    .from("workout_days")
    .select("workout_entries(is_done, skipped)")
    .eq("date", date);

  if (error) {
    console.error(`[syncFitnessTasks] ${error.code ?? "error"}: ${error.message}`);
    return;
  }

  const entries = (
    (data ?? []) as { workout_entries: { is_done: boolean; skipped: boolean }[] }[]
  ).flatMap((day) => day.workout_entries ?? []);
  const allDone = isDayComplete(entries);

  // RLS scopes this to the caller's own tasks; dayFilter picks the ones that
  // actually land on `date`, repeats included.
  const update = await supabase
    .from("tasks")
    .update({ done: allDone })
    .eq("kind", "fitness")
    .or(dayFilter(date));

  if (update.error) {
    console.error(
      `[syncFitnessTasks] ${update.error.code ?? "error"}: ${update.error.message}`,
    );
  }
}

/**
 * The lazy day row. Called by every mutation; never by a read, so browsing the
 * week does not litter the table with empty days.
 */
async function ensureDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
  date: string,
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await supabase.rpc("get_or_create_workout_day", {
    p_category_id: categoryId,
    p_date: date,
  });

  if (error) return { error: error.message };
  if (!data) return { error: "Could not open that day." };
  return { id: data as string };
}

/** The single day-level note, per category and date. */
export async function saveDayNote(
  _prev: GymFormState,
  formData: FormData,
): Promise<GymFormState> {
  await requireUser();

  const categoryId = String(formData.get("category_id") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!categoryId || !isValidDay(date)) return { error: "Pick a valid day." };

  const note = String(formData.get("day_note") ?? "").trim();

  const supabase = await createClient();
  const day = await ensureDay(supabase, categoryId, date);
  if (day.error) return { error: day.error };

  const { error } = await supabase
    .from("workout_days")
    .update({ day_note: note || null })
    .eq("id", day.id);

  if (error) return { error: error.message };

  revalidate();
  return { ok: true };
}

/** Adds a manual entry. Re-adding the same exercise is a no-op, not an error. */
export async function addEntry(
  _prev: GymFormState,
  formData: FormData,
): Promise<GymFormState> {
  const user = await requireUser();

  const categoryId = String(formData.get("category_id") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!categoryId || !isValidDay(date)) return { error: "Pick a valid day." };

  const name = String(formData.get("exercise_name") ?? "").trim();
  if (!name) return { error: "Name the exercise." };

  const supabase = await createClient();
  const day = await ensureDay(supabase, categoryId, date);
  if (day.error) return { error: day.error };

  const { error } = await supabase
    .from("workout_entries")
    .upsert(
      {
        workout_day_id: day.id,
        user_id: user.id,
        exercise_name: name,
        source: "manual",
      },
      { onConflict: "workout_day_id,exercise_name", ignoreDuplicates: true },
    );

  if (error) return { error: error.message };

  // A new exercise is outstanding, so a previously-finished day is finished no
  // longer — the task unticks itself.
  await syncFitnessTasks(supabase, date);

  revalidate();
  return { ok: true };
}

/**
 * `done` in the form is the CURRENT state, so the write is its inverse.
 * completed_at moves with it — a check constraint rejects the two disagreeing.
 */
export async function toggleEntry(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");
  const done = formData.get("done") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("workout_entries")
    .update({
      is_done: !done,
      completed_at: done ? null : new Date().toISOString(),
      // Doing an exercise is the opposite of passing on it, so ticking clears
      // any earlier skip rather than leaving the two states contradicting.
      skipped: false,
    })
    .eq("id", id);

  if (error) {
    console.error(`[toggleEntry] ${error.code ?? "error"}: ${error.message}`);
  }

  // Ticking the last outstanding exercise is what turns the Fitness task green.
  if (isValidDay(date)) await syncFitnessTasks(supabase, date);

  revalidate();
}

/**
 * Passes on an exercise for today without deleting it — it stays on the day as a
 * record of what was planned. Reversible: skipping something already skipped
 * un-skips it.
 *
 * `skipped` in the form is the CURRENT state, matching every other toggle here.
 */
export async function skipEntry(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");
  const skipped = formData.get("skipped") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("workout_entries")
    .update({
      skipped: !skipped,
      // A skipped exercise was not done. The check constraint requires these two
      // to agree, so they are cleared together.
      is_done: false,
      completed_at: null,
    })
    .eq("id", id);

  if (error) {
    console.error(`[skipEntry] ${error.code ?? "error"}: ${error.message}`);
  }

  // Skipping the last outstanding exercise completes the day.
  if (isValidDay(date)) await syncFitnessTasks(supabase, date);

  revalidate();
}

export async function removeEntry(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("workout_entries").delete().eq("id", id);

  if (error) {
    console.error(`[removeEntry] ${error.code ?? "error"}: ${error.message}`);
  }

  // Removing the last unfinished exercise can complete the day; removing the
  // last one entirely empties it and unticks the task.
  if (isValidDay(date)) await syncFitnessTasks(supabase, date);

  revalidate();
}
