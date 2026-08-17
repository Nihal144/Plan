import Link from "next/link";
import Image from "next/image";
import { requireUser, getTasksForDay, getWeekCounts, getPairingState } from "@/lib/dal";
import { signOut } from "@/app/actions/auth";
import { today, weekOf, formatTime, longDayLabel } from "@/lib/dates";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const user = await requireUser();
  const todayStr = today();
  const week = weekOf(todayStr);

  const [tasks, weekCounts, pairing] = await Promise.all([
    getTasksForDay(todayStr),
    getWeekCounts(week[0], week[6]),
    getPairingState(),
  ]);

  const done = tasks.filter((t) => t.done).length;
  const remaining = tasks.length - done;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const upNext = tasks.filter((t) => !t.done).slice(0, 3);

  const weekTotal = Object.values(weekCounts).reduce((n, c) => n + c.total, 0);
  const weekDone = Object.values(weekCounts).reduce((n, c) => n + c.done, 0);

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "there";
  const firstName = fullName.split(" ")[0];
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="flex flex-col gap-7 px-6 py-8 lg:px-10 lg:py-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            {longDayLabel(todayStr)}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight lg:text-[2.4rem]">
            {greeting(new Date().getHours())}, {firstName}
          </h1>
        </div>
        {avatar && (
          <Image
            src={avatar}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover"
            unoptimized
          />
        )}
      </header>

      {/* Today at a glance */}
      <section className="flex flex-col gap-4 rounded-2xl bg-zinc-100/70 p-6 dark:bg-zinc-800/40">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-bold">Today</h2>
          <Link
            href="/plan/tasks"
            className="text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400"
          >
            Open tasks →
          </Link>
        </div>

        {tasks.length === 0 ? (
          <p className="py-2 text-zinc-500 dark:text-zinc-400">
            Nothing scheduled today.{" "}
            <Link href="/plan/tasks" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
              Add something
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div
                className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
                role="img"
                aria-label={`${percent}% of today's tasks completed`}
              >
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-sm font-bold tabular-nums">{percent}%</span>
            </div>

            <dl className="grid grid-cols-3 gap-3">
              <Stat label="Done" value={done} tone="text-emerald-600 dark:text-emerald-400" />
              <Stat label="Remaining" value={remaining} tone="text-orange-600 dark:text-orange-400" />
              <Stat label="This week" value={`${weekDone}/${weekTotal}`} tone="" />
            </dl>
          </>
        )}
      </section>

      {/* Up next */}
      {upNext.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Up next
          </h2>
          {upNext.map((task) => {
            const time = formatTime(task.scheduled_time);
            return (
              <Link
                key={task.id}
                href="/plan/tasks"
                className="flex items-center gap-4 rounded-2xl border border-zinc-200 px-4 py-3.5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              >
                <span className="h-7 w-7 shrink-0 rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold [overflow-wrap:anywhere]">{task.text}</span>
                  {time && (
                    <span className="mt-0.5 block text-sm tabular-nums text-zinc-400 dark:text-zinc-500">
                      {time}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {/* Partner */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Partner
        </h2>
        <Link
          href="/partner"
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 px-4 py-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
        >
          {pairing.pair ? (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                {(pairing.pair.display_name ?? "?").charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {pairing.pair.display_name ?? "Your partner"}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Paired</span>
              </span>
            </>
          ) : (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Not paired yet</span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {pairing.pendingRequests.length > 0
                    ? `${pairing.pendingRequests.length} request waiting`
                    : "Share a code to link up"}
                </span>
              </span>
            </>
          )}
          <span className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
      </section>

      {/* The rail carries sign-out on desktop; on mobile the tab bar is kept to
          exactly three destinations, so it lives here instead. */}
      <form action={signOut} className="lg:hidden">
        <button
          type="submit"
          className="w-full rounded-2xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-3 dark:bg-zinc-900/60">
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`mt-0.5 text-xl font-bold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
