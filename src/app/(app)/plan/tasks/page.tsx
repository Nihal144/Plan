import Image from "next/image";
import {
  requireUser,
  getTasksForDay,
  getWeekCounts,
  getPairingState,
  type Task,
} from "@/lib/dal";
import { toggleTask, deleteTask, deferTask } from "@/app/actions/tasks";
import {
  today,
  isValidDay,
  weekOf,
  formatTime,
  periodOf,
  PERIOD_LABELS,
  PERIOD_ORDER,
  type Period,
} from "@/lib/dates";
import Link from "next/link";
import { WeekStrip } from "../week-strip";
import { AddTask } from "./add-task";
import { ViewSwitcher } from "../view-switcher";

/**
 * Tags are free text, so their colour is derived from the text itself — the same
 * tag always gets the same swatch without needing a lookup table or a migration
 * every time someone invents a category.
 */
const TAG_STYLES = [
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
];

function tagStyle(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_STYLES[hash % TAG_STYLES.length];
}


export default async function TasksPage({ searchParams }: PageProps<"/plan/tasks">) {
  const user = await requireUser();
  const params = await searchParams;

  const todayStr = today();
  const rawDate = typeof params.date === "string" ? params.date : undefined;
  const selected = isValidDay(rawDate) ? rawDate : todayStr;
  const query = (typeof params.q === "string" ? params.q : "").trim();

  const week = weekOf(selected);
  const [allTasks, counts, pairing] = await Promise.all([
    getTasksForDay(selected),
    getWeekCounts(week[0], week[6]),
    getPairingState(),
  ]);

  const partnerName = pairing.pair?.display_name ?? null;

  const matching = query
    ? allTasks.filter((t) => t.text.toLowerCase().includes(query.toLowerCase()))
    : allTasks;

  // Since 0009 the day can also carry a partner's looped-in tasks. They are shown
  // separately and excluded from your own progress — they are not your work.
  const tasks = matching.filter((t) => t.user_id === user.id);
  const loopedIn = matching.filter((t) => t.user_id !== user.id);

  const doneCount = tasks.filter((t) => t.done).length;
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const groups = PERIOD_ORDER.map((period) => ({
    period,
    items: tasks.filter((t) => periodOf(t.scheduled_time) === period),
  })).filter((g) => g.items.length > 0);

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Account";
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="flex flex-col gap-8 px-6 py-8 lg:px-10 lg:py-9">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <ViewSwitcher current="/plan/tasks" date={selected} />

        <div className="flex items-center gap-3">
          {/* A real filter over the selected day, not a decorative search icon. */}
          <form method="get" className="relative">
            <input type="hidden" name="date" value={selected} />
            <label htmlFor="task-search" className="sr-only">
              Filter this day&apos;s tasks
            </label>
            <input
              id="task-search"
              name="q"
              defaultValue={query}
              placeholder="Filter tasks…"
              className="w-40 rounded-full border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm transition-[width] focus:w-56 focus:border-violet-400 focus:outline-none focus:ring-[3px] focus:ring-violet-500/15 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </form>

          <div className="flex items-center gap-2.5 rounded-full border border-zinc-200 py-1.5 pl-1.5 pr-4 dark:border-zinc-700">
            {avatar ? (
              <Image
                src={avatar}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="max-w-[10rem] truncate text-sm font-medium">{name}</span>
          </div>
        </div>
      </header>

      {/* Two columns on desktop: the day on the left, actions and progress on the right. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <WeekStrip
            selected={selected}
            todayStr={todayStr}
            counts={counts}
            basePath="/plan/tasks"
          />

          {groups.length === 0 && loopedIn.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-700">
              <p className="font-medium text-zinc-500 dark:text-zinc-400">
                {query ? "Nothing matches that filter." : "Nothing scheduled for this day."}
              </p>
              {!query && (
                <p className="mt-1 text-sm text-zinc-400">
                  Add something to get started.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-7">
              {groups.map((group) => (
                <section key={group.period} className="flex flex-col gap-2.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {PERIOD_LABELS[group.period as Period]}
                  </h2>
                  {group.items.map((task) => (
                    <TaskRow key={task.id} task={task} day={selected} />
                  ))}
                </section>
              ))}

              {loopedIn.length > 0 && (
                <section className="flex flex-col gap-2.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    {partnerName ? `${partnerName} looped you in` : "Looped in"}
                  </h2>
                  {loopedIn.map((task) => (
                    <LoopedTaskRow key={task.id} task={task} />
                  ))}
                </section>
              )}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <AddTask day={selected} partnerName={partnerName} />
          <CompletionCard percent={percent} done={doneCount} total={tasks.length} />
        </aside>
      </div>
    </div>
  );
}

function TaskRow({ task, day }: { task: Task; day: string }) {
  const time = formatTime(task.scheduled_time);
  const isFitness = task.kind === "fitness";

  // Done wins over fitness: a finished task should read as finished whatever
  // kind it is.
  const tone = task.done
    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10"
    : isFitness
      ? "border-orange-300 bg-orange-50 hover:border-orange-400 dark:border-orange-500/40 dark:bg-orange-500/10"
      : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700";

  return (
    <div
      className={`group relative flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-colors ${tone}`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`flex items-center gap-2 font-semibold ${
            task.done
              ? "text-emerald-800 dark:text-emerald-200/80"
              : isFitness
                ? "text-orange-900 dark:text-orange-200"
                : ""
          }`}
        >
          {/* Marks completion without striking the text out, so a finished task
              stays readable. The label lives on the "Completed" badge. */}
          {task.done && <CircleCheck />}
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {/*
              A fitness task opens its own list. The link is stretched over the whole
              card with `after:inset-0` rather than wrapping it — the card already
              holds three submit buttons, and an anchor may not contain them.
            */}
            {isFitness ? (
              <Link
                href={`/plan/fitness?date=${day}#task-${task.id}`}
                className="after:absolute after:inset-0 after:rounded-2xl hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-500"
              >
                {task.text}
              </Link>
            ) : (
              task.text
            )}
          </span>
        </p>
        {(time || task.repeat_daily || task.shared_with_partner) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
            {time && <span className="tabular-nums">{time}</span>}
            {/* So you can tell at a glance which of your tasks your partner sees. */}
            {task.shared_with_partner && (
              <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400" title="Your partner can see this">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Looped in
              </span>
            )}
            {task.repeat_daily && (
              <span className="flex items-center gap-1" title="Repeats every day">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 2l4 4-4 4" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 22l-4-4 4-4" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                Daily
              </span>
            )}
          </p>
        )}
      </div>

      {/* z-10 keeps the buttons clickable through the stretched link above. */}
      <div className="relative z-10 flex shrink-0 items-center gap-3">
        {task.category && (
          <span className={`hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline ${tagStyle(task.category)}`}>
            {task.category}
          </span>
        )}

        {/*
          A finished task is settled: the badge takes the slot the actions occupied
          rather than sitting under the title, so the row does not reflow when it is
          ticked. Nothing to tick, delete or defer once it is done.
        */}
        {task.done ? (
          <span className="flex h-8 items-center rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white dark:bg-emerald-500">
            Completed
          </span>
        ) : (
          /* `max-sm:opacity-100` covers touch, where hover never fires. */
          <div className="flex items-center gap-1 opacity-0 transition-opacity max-sm:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100">
            <form action={toggleTask} className="flex">
              <input type="hidden" name="id" value={task.id} />
              {/* Current state, not the target — the action inverts it. */}
              <input type="hidden" name="done" value="false" />
              <button
                type="submit"
                aria-label={`Mark “${task.text}” as done`}
                title="Mark as done"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
              >
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 6.2l2.6 2.6L10 3.4" />
                </svg>
              </button>
            </form>

            <form action={deleteTask} className="flex">
              <input type="hidden" name="id" value={task.id} />
              <button
                type="submit"
                aria-label={`Delete “${task.text}”`}
                title="Delete task"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M2 2l10 10M12 2L2 12" />
                </svg>
              </button>
            </form>

            {/* Meaningless for a repeat: it is one row that already lands on tomorrow,
                and pushing its start date would erase it from every earlier day. */}
            {!task.repeat_daily && (
              <form action={deferTask} className="flex">
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="day" value={day} />
                <button
                  type="submit"
                  aria-label={`Move “${task.text}” to tomorrow`}
                  title="Finish tomorrow"
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-zinc-500 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h13" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                  <span className="hidden lg:inline">Finish tomorrow</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A task your partner looped you in on.
 *
 * Read-only by construction, not by hiding buttons: 0009 relaxed only the SELECT
 * policy, so an insert, update or delete against this row is rejected by Postgres.
 * Offering a tick that always fails would be worse than offering none.
 */
function LoopedTaskRow({ task }: { task: Task }) {
  const time = formatTime(task.scheduled_time);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3.5 dark:border-sky-500/30 dark:bg-sky-500/10">
      <div className="min-w-0 flex-1">
        <p
          className={`flex items-center gap-2 font-semibold ${
            task.done ? "text-emerald-800 dark:text-emerald-200/80" : ""
          }`}
        >
          {task.done && <CircleCheck />}
          <span className="min-w-0 [overflow-wrap:anywhere]">{task.text}</span>
        </p>
        {(time || task.repeat_daily || task.done) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
            {time && <span className="tabular-nums">{time}</span>}
            {task.repeat_daily && <span>Daily</span>}
            {task.done && (
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                Done
              </span>
            )}
          </p>
        )}
      </div>

      <span className="shrink-0 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white dark:bg-sky-500">
        Looped in
      </span>
    </div>
  );
}

/**
 * lucide `circle-check`, inlined. The project has no icon dependency — every
 * other icon here is hand-inlined SVG, so adding one for a single glyph would
 * ship a package to render nine paths.
 */
function CircleCheck() {
  return (
    <svg
      width="18"
      height="18"
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

function CompletionCard({ percent, done, total }: { percent: number; done: number; total: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-zinc-100/70 p-6 dark:bg-zinc-800/40">
      <h2 className="text-lg font-bold">Task Completion</h2>

      <div className="flex justify-center">
        <div className="relative">
          <svg width="150" height="150" viewBox="0 0 130 130" role="img"
               aria-label={`${percent}% of tasks completed`}>
            <circle cx="65" cy="65" r={radius} fill="none" strokeWidth="13"
                    className="stroke-zinc-200 dark:stroke-zinc-700" />
            {percent > 0 && (
              <circle
                cx="65" cy="65" r={radius} fill="none" strokeWidth="13" strokeLinecap="round"
                className="stroke-emerald-600 dark:stroke-emerald-500"
                strokeDasharray={`${filled} ${circumference - filled}`}
                /* Start the arc at 12 o'clock rather than 3 o'clock. */
                transform="rotate(-90 65 65)"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums">{percent}%</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Completed
            </span>
          </div>
        </div>
      </div>

      <dl className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-2 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
            Done
          </dt>
          <dd className="text-sm font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
            {done} {done === 1 ? "Task" : "Tasks"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-2 font-medium">
            <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" />
            In Progress
          </dt>
          <dd className="text-sm font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
            {total - done} {total - done === 1 ? "Task" : "Tasks"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
