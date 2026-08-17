"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { addDays, isValidDay } from "@/lib/dates";

/**
 * Task mutations. Every write sets or filters on the caller's own id, and the
 * RLS policies on `tasks` reject anything else even if this
 * code were wrong.
 */

export type TaskFormState = { error?: string; ok?: boolean };

function revalidate() {
  revalidatePath("/plan/tasks");
  revalidatePath("/plan/fitness");
  revalidatePath("/home");
}

export async function addTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Give the task a name." };

  const day = String(formData.get("scheduled_on") ?? "");
  if (!isValidDay(day)) return { error: "Pick a valid date." };

  const rawTime = String(formData.get("scheduled_time") ?? "").trim();
  const rawCategory = String(formData.get("category") ?? "").trim();

  // Checked here as well as by the column's constraint: a rejected insert comes
  // back as a Postgres error string, and "violates check constraint
  // tasks_duration_minutes_check" is not something to show a person.
  const rawDuration = String(formData.get("duration_minutes") ?? "").trim();
  const duration = rawDuration ? Number(rawDuration) : null;
  if (duration !== null && (!Number.isInteger(duration) || duration <= 0 || duration > 1440)) {
    return { error: "How long should be a whole number of minutes, up to 1440 (24h)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    text,
    scheduled_on: day,
    // <input type="time"> gives "HH:MM"; Postgres `time` accepts that directly.
    scheduled_time: rawTime || null,
    duration_minutes: duration,
    category: rawCategory || null,
    repeat_daily: formData.get("repeat_daily") === "on",
    // Anything but the fitness checkbox is a general task — the column's check
    // constraint would reject a third value anyway, so never pass it through raw.
    kind: formData.get("kind") === "fitness" ? "fitness" : "general",
    // Opt-in per task. Harmless when unpaired: the SELECT policy only widens for
    // an actual partner, so a flag set with nobody attached shares with nobody.
    shared_with_partner: formData.get("shared_with_partner") === "on",
  });

  if (error) return { error: error.message };

  revalidate();
  return { ok: true };
}

/**
 * Completion is a flag on the task itself. A repeating task is a single row, so
 * ticking it marks it done on every day it appears, not just today.
 *
 * `done` in the form is the CURRENT state, so the write is its inverse — sending
 * the target state instead would make a stale page toggle the wrong way.
 */
export async function toggleTask(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const done = formData.get("done") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ done: !done }).eq("id", id);

  // Never swallow this. The page re-renders from the row, so a failed write looks
  // exactly like a task the user never ticked — the card springs back to white and
  // nothing anywhere says why. A missing column reads as "it just doesn't work"
  // rather than "run the migration".
  if (error) {
    console.error(`[toggleTask] ${error.code ?? "error"}: ${error.message}`);
  }

  revalidate();
}

/**
 * "Finish tomorrow" — moves a task to the following day.
 *
 * Only ever touches one-offs. A repeating task is a single row that materialises
 * on every day from `scheduled_on` onward, so advancing that date would not move
 * it off today alone — it would erase it from every earlier day too. The button is
 * hidden for repeats in the UI; `.eq("repeat_daily", false)` is the real guard,
 * since a Server Action is a public endpoint.
 */
export async function deferTask(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const day = String(formData.get("day") ?? "");
  if (!id || !isValidDay(day)) return;

  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ scheduled_on: addDays(day, 1) })
    .eq("id", id)
    .eq("repeat_daily", false);

  if (error) {
    console.error(`[deferTask] ${error.code ?? "error"}: ${error.message}`);
  }

  revalidate();
}

/** Deletes the task outright — for a repeating task that means every day. */
export async function deleteTask(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", id);

  revalidate();
}
