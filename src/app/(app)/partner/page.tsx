import Link from "next/link";
import {
  requireUser,
  getPairingState,
  getLoopedTasks,
  type Task,
} from "@/lib/dal";
import { today, formatTime, longDayLabel } from "@/lib/dates";
import {
  CodePanel,
  RedeemForm,
  RequestList,
  PairedPanel,
} from "./pair-controls";

export default async function PartnerPage() {
  await requireUser();
  const todayStr = today();
  const [{ pair, pendingRequests, outgoing, liveCode }, looped] = await Promise.all([
    getPairingState(),
    getLoopedTasks(todayStr),
  ]);

  const partnerName = pair?.display_name ?? "Your partner";

  return (
    <div className="flex flex-col gap-7 px-6 py-8 lg:px-10 lg:py-9">
      <header>
        <h1 className="text-3xl font-bold tracking-tight lg:text-[2.4rem]">Partner</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          {pair ? "You're linked up." : "Link up with one other person."}
        </p>
      </header>

      {pair ? (
        <div className="flex max-w-[560px] flex-col gap-5">
          {/* Profile card */}
          <div className="flex items-center gap-4 rounded-2xl bg-zinc-100/70 p-6 dark:bg-zinc-800/40">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              {(pair.display_name ?? "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">
                {pair.display_name ?? "Your partner"}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Paired
              </p>
            </div>
          </div>

          {/* Today only. This page has no date picker, and the day views already
              show looped-in tasks per day — this is the "what's live right now"
              summary, so it says which day it means rather than implying all of them. */}
          <section className="flex flex-col gap-4 rounded-2xl bg-zinc-100/70 p-6 dark:bg-zinc-800/40">
            <div>
              <h2 className="font-bold">Looped in</h2>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {longDayLabel(todayStr)}. Everything else stays private to each of
                you — that boundary is enforced in the database, not just here.
              </p>
            </div>

            {looped.fromPartner.length === 0 && looped.toPartner.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 px-5 py-8 text-center dark:border-zinc-700">
                <p className="font-semibold">Nothing looped in today</p>
                <p className="mx-auto mt-1 max-w-[38ch] text-sm text-zinc-500 dark:text-zinc-400">
                  Tick “Loop {partnerName}” when you add something to share it. You
                  can loop them in on one task without opening up the rest.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <TaskGroup
                  title={`${partnerName} looped you in`}
                  empty={`${partnerName} hasn't shared anything today.`}
                  tasks={looped.fromPartner}
                />
                <TaskGroup
                  title={`You looped ${partnerName} in`}
                  empty="You haven't shared anything today."
                  tasks={looped.toPartner}
                  // Only your own tasks are yours to change, so only these link out.
                  href={`/plan/tasks?date=${todayStr}`}
                />
              </div>
            )}
          </section>

          <div className="rounded-2xl bg-zinc-100/70 p-6 dark:bg-zinc-800/40">
            <PairedPanel pair={pair} />
          </div>
        </div>
      ) : (
        <div className="max-w-[560px] rounded-2xl bg-zinc-100/70 p-6 dark:bg-zinc-800/40">
          <CodePanel liveCode={liveCode} />
          <RedeemForm outgoing={outgoing} />
          <RequestList requests={pendingRequests} />
        </div>
      )}
    </div>
  );
}

/**
 * One side of the loop. Rendered even when empty: "nothing came back" and "they
 * shared nothing" look identical otherwise, and which direction is quiet is the
 * thing you came to this page to find out.
 */
function TaskGroup({
  title,
  empty,
  tasks,
  href,
}: {
  title: string;
  empty: string;
  tasks: Task[];
  /** Where to go to act on these. Omitted for the partner's tasks — read-only by policy. */
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {title}
        </h3>
        {href && tasks.length > 0 && (
          <Link
            href={href}
            className="text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
          >
            Manage
          </Link>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <LoopedRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LoopedRow({ task }: { task: Task }) {
  const time = formatTime(task.scheduled_time);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/60 px-3.5 py-2.5 dark:border-sky-500/30 dark:bg-sky-500/10">
      <div className="min-w-0 flex-1">
        <p
          className={`flex items-center gap-2 text-sm font-semibold ${
            task.done ? "text-emerald-800 dark:text-emerald-200/80" : ""
          }`}
        >
          {task.done && <CircleCheck />}
          <span className="min-w-0 [overflow-wrap:anywhere]">{task.text}</span>
        </p>
        {(time || task.repeat_daily) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
            {time && <span className="tabular-nums">{time}</span>}
            {task.repeat_daily && <span>Daily</span>}
          </p>
        )}
      </div>

      {/* State is never carried by colour alone. */}
      {task.done && (
        <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          Done
        </span>
      )}
    </li>
  );
}

/** lucide `circle-check`, inlined to match the task cards. */
function CircleCheck() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-emerald-600 dark:text-emerald-400"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
