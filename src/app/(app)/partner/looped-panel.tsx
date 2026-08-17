import { relativeDayLabel } from "@/lib/dates";
import { groupLooped, type LoopedDay } from "@/lib/looped";
import type { LoopedTask } from "@/lib/dal";
import { Timeline, TimelineRow } from "@/app/(app)/plan/tasks/timeline";

/**
 * The shared fortnight, as it appears on the Partner page.
 *
 * No heading of its own: the page is about the two of you, and everything on it is
 * shared, so a "Looped in" banner over the only content is a label on a label. The
 * day headings carry the structure instead.
 *
 * Its own component because the page around it is about the pairing itself —
 * codes, requests, unpairing — and this is about the work. Taking `looped` as a
 * prop also means it can be rendered against fixtures without a session.
 */
export function LoopedPanel({
  looped,
  todayStr,
  partnerName,
}: {
  looped: LoopedTask[];
  todayStr: string;
  partnerName: string;
}) {
  const { everyDay, days } = groupLooped(looped, todayStr);

  // Decided once for the whole panel rather than per group. Per group would be
  // tighter, but the rail would sit at a different offset in each one and the
  // groups would no longer line up with each other down the page.
  const gutter = looped.some((item) => item.task.scheduled_time);

  if (everyDay.length === 0 && days.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
        <p className="font-semibold">Nothing shared yet</p>
        <p className="mx-auto mt-1 max-w-[42ch] text-sm text-zinc-500 dark:text-zinc-400">
          Tick “Loop {partnerName}” when either of you adds a task, and it shows up
          here. You can loop them in on one task without opening up the rest.
        </p>
      </div>
    );
  }

  // Split by day rather than by owner: what you want from this page is "what is
  // coming up between us", and the line under each task answers whose it is
  // without cutting the fortnight in half.
  return (
    <div className="flex flex-col gap-6">
      {everyDay.length > 0 && (
        <DayGroup
          label="Every day"
          day={todayStr}
          items={everyDay}
          partnerName={partnerName}
          gutter={gutter}
        />
      )}

      {days.map((group) => (
        <DayGroup
          key={group.day}
          label={relativeDayLabel(group.day, todayStr)}
          day={group.day}
          items={group.items}
          partnerName={partnerName}
          gutter={gutter}
        />
      ))}
    </div>
  );
}

/**
 * One heading and the tasks under it.
 *
 * Reuses the day view's timeline rather than a second list style — a looped-in
 * task should look like the same object in both places. `readOnly` is set for the
 * partner's rows: 0009 relaxed only the SELECT policy, so every write against them
 * would be rejected by Postgres, and a menu whose items all fail is worse than no
 * menu. Your own rows keep theirs and work from here.
 */
function DayGroup({
  label,
  day,
  items,
  partnerName,
  gutter,
}: {
  label: string;
  day: string;
  items: LoopedDay["items"];
  partnerName: string;
  gutter: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </h2>
      <Timeline gutter={gutter}>
        {items.map(({ task, mine }) => (
          <TimelineRow
            key={task.id}
            task={task}
            day={day}
            readOnly={!mine}
            gutter={gutter}
            /*
              Only two people can appear on this page, so naming both on every row
              would be noise. The line names the other one — and the difference
              between "with Sneha" and "Sneha's" is what tells you whose task it is,
              which is the one thing here that actually varies.
            */
            attribution={mine ? `with ${partnerName}` : `${partnerName}’s`}
          />
        ))}
      </Timeline>
    </div>
  );
}
