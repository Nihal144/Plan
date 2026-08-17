import Image from "next/image";
import {
  requireUser,
  getTasksForDay,
  getWeekCounts,
  getPairingState,
} from "@/lib/dal";
import { today, isValidDay, weekOf } from "@/lib/dates";
import { WeekStrip } from "../week-strip";
import { AddTask } from "./add-task";
import { Timeline, TimelineRow, RailLabel } from "./timeline";
import { ViewSwitcher } from "../view-switcher";

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

  // The timeline is one unbroken run down the day, so the split is by "has a time"
  // rather than by period: the query already sorts timed work by clock and puts
  // untimed last, which is exactly the order the rail wants. The old Morning /
  // Afternoon / Evening headings would cut the rail into four, and the times in
  // the gutter say the same thing more precisely.
  const timed = tasks.filter((t) => t.scheduled_time);
  const untimed = tasks.filter((t) => !t.scheduled_time);

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

          {tasks.length === 0 && loopedIn.length === 0 ? (
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
              {tasks.length > 0 && (
                <Timeline>
                  {timed.map((task) => (
                    <TimelineRow key={task.id} task={task} day={selected} />
                  ))}

                  {/* The rail runs on through this marker, so the untimed tail
                      reads as the end of the same day rather than a second list. */}
                  {untimed.length > 0 && <RailLabel>Anytime</RailLabel>}

                  {untimed.map((task) => (
                    <TimelineRow key={task.id} task={task} day={selected} />
                  ))}
                </Timeline>
              )}

              {loopedIn.length > 0 && (
                <section className="flex flex-col gap-2.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    {partnerName ? `${partnerName} looped you in` : "Looped in"}
                  </h2>
                  <Timeline>
                    {loopedIn.map((task) => (
                      <TimelineRow key={task.id} task={task} day={selected} readOnly />
                    ))}
                  </Timeline>
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
