import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";

/**
 * Data Access Layer.
 *
 * The Next 16 auth guide is explicit that proxy checks are optimistic only and
 * "should not be your only line of defense", and that auth checks do not belong
 * in layouts (they don't re-render on navigation, and don't stop sibling segments
 * from rendering). So every read and every Server Action goes through here.
 *
 * `getUser()` hits the Auth server to verify the token rather than trusting the
 * cookie. `cache()` dedupes that within a single render pass.
 */

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** Use in any page or action that requires a signed-in user. */
export const requireUser = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
});

export type PairStatus = {
  pair_id: string;
  partner_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type PendingRequest = {
  request_id: string;
  requester_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type OutgoingRequest = {
  request_id: string;
  addressee_id: string;
  display_name: string | null;
  status: string;
  created_at: string;
};

export type LiveCode = { code: string; expires_at: string };

/**
 * Everything the /pair page needs, in one pass.
 * All of these resolve the caller from auth.uid() inside Postgres — none of them
 * take a user id from the client.
 */
export const getPairingState = cache(async () => {
  const supabase = await createClient();

  const [pair, pending, outgoing, code] = await Promise.all([
    supabase.rpc("get_pair_status").maybeSingle(),
    supabase.rpc("get_pending_requests"),
    supabase.rpc("get_outgoing_request").maybeSingle(),
    supabase
      .from("invite_codes")
      .select("code, expires_at")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle(),
  ]);

  for (const [name, result] of [
    ["get_pair_status", pair],
    ["get_pending_requests", pending],
    ["get_outgoing_request", outgoing],
    ["invite_codes", code],
  ] as const) {
    if (result.error) logQueryError(`getPairingState/${name}`, result.error);
  }

  return {
    pair: (pair.data as PairStatus | null) ?? null,
    pendingRequests: (pending.data as PendingRequest[] | null) ?? [],
    outgoing: (outgoing.data as OutgoingRequest | null) ?? null,
    liveCode: (code.data as LiveCode | null) ?? null,
  };
});

/** A fitness task carries its own sub-tasks; a general one is just a line on a day. */
export type TaskKind = "general" | "fitness";

export type Task = {
  id: string;
  /** Whose task it is. Since 0009 a day can also contain a partner's looped-in tasks. */
  user_id: string;
  text: string;
  done: boolean;
  scheduled_on: string;
  scheduled_time: string | null;
  /** How long it takes, in minutes. Null for the many tasks that are just a line on a day. */
  duration_minutes: number | null;
  category: string | null;
  repeat_daily: boolean;
  kind: TaskKind;
  shared_with_partner: boolean;
  created_at: string;
};

const TASK_COLUMNS =
  "id, user_id, text, done, scheduled_on, scheduled_time, duration_minutes, category, repeat_daily, kind, shared_with_partner, created_at";

/**
 * A task belongs on `day` if it is a one-off scheduled for that exact day, or a
 * repeating task that started on or before it.
 *
 * Exported so the gym actions can target exactly the same set of tasks when they
 * sync fitness completion — two copies of this rule would drift.
 */
export function dayFilter(day: string) {
  return `and(repeat_daily.eq.false,scheduled_on.eq.${day}),and(repeat_daily.eq.true,scheduled_on.lte.${day})`;
}

/**
 * Surfaces query failures in the server log instead of letting them fall through
 * as an empty result. PostgREST reports a missing column or an RLS problem as an
 * error with data === null, which otherwise renders as a perfectly calm empty state.
 */
function logQueryError(where: string, error: { message: string; code?: string }) {
  console.error(`[dal:${where}] ${error.code ?? "error"}: ${error.message}`);
}

/**
 * Tasks for one calendar day.
 *
 * RLS restricts this to the caller's own rows, so there is no user_id filter
 * here by design — the database is the boundary, not this query.
 * Untimed tasks sort last: `nullsFirst: false` puts "anytime" work after the
 * scheduled part of the day rather than above breakfast.
 */
export const getTasksForDay = cache(async (day: string): Promise<Task[]> => {
  const supabase = await createClient();

  const tasks = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .or(dayFilter(day))
    .order("scheduled_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  // Never return [] for a *failed* query without saying so: an empty list and a
  // broken query look identical in the UI ("Nothing scheduled"), which hides
  // things like a migration that was never applied.
  if (tasks.error) logQueryError("getTasksForDay", tasks.error);

  return (tasks.data ?? []) as Task[];
});

/** A looped-in task, tagged with which side of the pair owns it. */
export type LoopedTask = { task: Task; mine: boolean };

/**
 * Every looped-in task in a date window, both directions, in a single query.
 *
 * Since 0009 the SELECT policy returns your own rows plus your partner's opted-in
 * ones, so filtering on `shared_with_partner` already yields both sides — the
 * owner tag is applied in memory rather than in a second round trip. Nothing here
 * names a user id to the database: the policy decides what comes back.
 *
 * The window matches `getWeekCounts`: one-offs inside it, plus every repeating
 * task that had started by the end of it, since a repeat lands on every day from
 * its start date onward.
 */
export const getLoopedTasks = cache(
  async (from: string, to: string): Promise<LoopedTask[]> => {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return [];

    const tasks = await supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("shared_with_partner", true)
      .or(
        `and(repeat_daily.eq.false,scheduled_on.gte.${from},scheduled_on.lte.${to}),` +
          `and(repeat_daily.eq.true,scheduled_on.lte.${to})`,
      )
      // Chronological, which is the order the page groups them in.
      .order("scheduled_on", { ascending: true })
      .order("scheduled_time", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (tasks.error) logQueryError("getLoopedTasks", tasks.error);

    return ((tasks.data ?? []) as Task[]).map((task) => ({
      task,
      mine: task.user_id === user.id,
    }));
  },
);

/**
 * Per-day totals for the whole visible week, so the strip can show which days
 * carry work without fetching every task twice.
 *
 * `kind` narrows it to one type of task — the Fitness view's strip counts only
 * fitness tasks, so its dots describe the page you are looking at.
 */
export const getWeekCounts = cache(
  async (
    from: string,
    to: string,
    kind?: TaskKind,
  ): Promise<Record<string, { total: number; done: number }>> => {
    const supabase = await createClient();

    // Own tasks only. Since 0009 the SELECT policy also returns a partner's
    // looped-in tasks, and those must not inflate your own week's progress.
    const user = await getUser();

    // One-offs inside the window, plus every repeating task that had started by
    // the end of it — a repeat contributes to each day at or after its start.
    let query = supabase
      .from("tasks")
      .select("id, scheduled_on, repeat_daily, done")
      .eq("user_id", user?.id ?? "")
      .or(
        `and(repeat_daily.eq.false,scheduled_on.gte.${from},scheduled_on.lte.${to}),` +
          `and(repeat_daily.eq.true,scheduled_on.lte.${to})`,
      );

    if (kind) query = query.eq("kind", kind);

    const tasks = await query;

    if (tasks.error) logQueryError("getWeekCounts", tasks.error);

    const counts: Record<string, { total: number; done: number }> = {};
    const rows = (tasks.data ?? []) as {
      id: string;
      scheduled_on: string;
      repeat_daily: boolean;
      done: boolean;
    }[];

    for (let day = from; day <= to; day = addDays(day, 1)) {
      for (const row of rows) {
        const belongs = row.repeat_daily
          ? row.scheduled_on <= day
          : row.scheduled_on === day;
        if (!belongs) continue;

        const bucket = (counts[day] ??= { total: 0, done: 0 });
        bucket.total += 1;
        // `done` lives on the task, so a ticked repeat reads as done on every
        // day it appears — not just the one it was ticked on.
        if (row.done) bucket.done += 1;
      }
    }
    return counts;
  },
);

export type FitnessItem = {
  id: string;
  task_id: string;
  text: string;
  done: boolean;
  created_at: string;
};

export type FitnessGroup = { task: Task; items: FitnessItem[] };

/**
 * The day's fitness tasks, each with its own sub-tasks.
 *
 * Two queries, not one per task: the items come back in a single `.in(task_id, …)`
 * and are grouped here. `dayFilter` is shared with getTasksForDay so a repeating
 * fitness task lands on the same days in both views.
 */
export const getFitnessDay = cache(async (day: string): Promise<FitnessGroup[]> => {
  const supabase = await createClient();

  const tasks = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("kind", "fitness")
    .or(dayFilter(day))
    .order("scheduled_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (tasks.error) logQueryError("getFitnessDay", tasks.error);

  const rows = (tasks.data ?? []) as Task[];
  if (rows.length === 0) return [];

  const items = await supabase
    .from("fitness_items")
    .select("id, task_id, text, done, created_at")
    .in(
      "task_id",
      rows.map((t) => t.id),
    )
    .order("created_at", { ascending: true });

  if (items.error) logQueryError("getFitnessDay/items", items.error);

  const byTask = new Map<string, FitnessItem[]>();
  for (const item of (items.data ?? []) as FitnessItem[]) {
    const bucket = byTask.get(item.task_id);
    if (bucket) bucket.push(item);
    else byTask.set(item.task_id, [item]);
  }

  return rows.map((task) => ({ task, items: byTask.get(task.id) ?? [] }));
});
