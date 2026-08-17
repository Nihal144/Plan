import Link from "next/link";
import type { Task } from "@/lib/dal";
import { formatClock, formatDuration } from "@/lib/dates";
import { TaskGlyph } from "./task-glyph";
import { TaskMenu } from "./task-menu";

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


/**
 * The day as a rail.
 *
 * The line is one absolutely-positioned element on the list rather than a border
 * per row: a per-row border leaves a hairline gap at every join, and the run has
 * to look continuous for the badges to read as sitting *on* it. Its `left` is the
 * sum of the gutter and the gap plus half a badge — those numbers have to move
 * together, which is why `gutter` is a flag here rather than a class at the call
 * site.
 *
 * `gutter={false}` drops the time column entirely, for a list where nothing has a
 * clock time. Keeping it would indent every card past an empty strip.
 */
export function Timeline({
  children,
  gutter = true,
}: {
  children: React.ReactNode;
  gutter?: boolean;
}) {
  return (
    <ol className="relative flex flex-col gap-2.5">
      <span
        aria-hidden="true"
        /* With the gutter: 3.5rem + 0.75rem gap + half of the 2.5rem badge.
           Without it, just half the badge. */
        className={`absolute bottom-6 top-6 w-px bg-zinc-200 dark:bg-zinc-800 ${
          gutter ? "left-[5.5rem]" : "left-5"
        }`}
      />
      {children}
    </ol>
  );
}

/** A break in the rail that names what follows, for the run with no clock times. */
export function RailLabel({
  children,
  gutter = true,
}: {
  children: string;
  gutter?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 pt-1">
      {gutter && <span className="w-14 shrink-0" />}
      <span className="w-10 shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {children}
      </span>
    </li>
  );
}

/**
 * One task on the rail: time in the gutter, coloured badge on the line, card to
 * the right.
 *
 * `items-center` rather than `items-start` so the badge tracks the middle of a
 * tall card — a two-line task should not leave its icon stranded at the top.
 *
 * `readOnly` is for a partner's looped-in task. It hides the menu because 0009
 * relaxed only the SELECT policy: every write here would be rejected by Postgres,
 * and a menu whose every item silently fails is worse than no menu.
 */
export function TimelineRow({
  task,
  day,
  readOnly,
  attribution,
  gutter = true,
}: {
  task: Task;
  day: string;
  readOnly?: boolean;
  /** Must match the enclosing Timeline, or the badges fall off the line. */
  gutter?: boolean;
  /**
   * Who else is in on this task ("with Sneha", "Sneha's"), for lists that mix both
   * sides of a pair. Omitted on the day view, where every row is yours.
   */
  attribution?: string;
}) {
  const clock = formatClock(task.scheduled_time);
  const duration = formatDuration(task.duration_minutes);
  const isFitness = task.kind === "fitness";

  // The badge carries the colour, so the card stays quiet — except when done,
  // where the whole row should read as settled at a glance.
  const tone = task.done
    ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/25 dark:bg-emerald-500/10"
    : readOnly
      ? "border-sky-200 bg-sky-50/60 dark:border-sky-500/25 dark:bg-sky-500/10"
      : isFitness
        ? "border-orange-200 hover:border-orange-300 dark:border-orange-500/25 dark:hover:border-orange-500/40"
        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700";

  return (
    <li className="flex items-center gap-3">
      {gutter && (
        <time
          dateTime={task.scheduled_time ?? undefined}
          className="w-14 shrink-0 text-right text-sm tabular-nums text-zinc-400 dark:text-zinc-500"
        >
          {clock}
        </time>
      )}

      {/* Kept at full colour even for a partner's task: the sky card and the
            "Looped in" label already say it is read-only, and greying the badge
            made the row look broken rather than borrowed. */}
      <TaskGlyph task={task} />

      <div className={`relative min-w-0 flex-1 rounded-2xl border px-4 py-3 transition-colors ${tone}`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={`font-semibold [overflow-wrap:anywhere] ${
                task.done ? "text-emerald-900 dark:text-emerald-100" : ""
              }`}
            >
              {/*
                A fitness task opens its own list. The link is stretched over the
                card with `after:inset-0` rather than wrapping it — the card also
                holds the menu, and an anchor may not contain a button.
              */}
              {isFitness && !readOnly ? (
                <Link
                  href={`/plan/fitness?date=${day}#task-${task.id}`}
                  className="after:absolute after:inset-0 after:rounded-2xl hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-orange-500"
                >
                  {task.text}
                </Link>
              ) : (
                task.text
              )}
            </p>

            {/* The screenshot's subtitle: how long it takes, under what it is. */}
            {duration && (
              <p className="mt-0.5 text-sm text-zinc-400 dark:text-zinc-500">{duration}</p>
            )}
          </div>

          {!readOnly && (
            <TaskMenu
              taskId={task.id}
              taskText={task.text}
              done={task.done}
              day={day}
              repeatDaily={task.repeat_daily}
            />
          )}
        </div>

        {/* State is never carried by colour alone — every badge above is repeated
            here in words. */}
        <Meta
          task={task}
          readOnly={readOnly}
          attribution={attribution}
          /* Nowhere else to put it once the gutter is gone. */
          clock={gutter ? null : clock}
        />
      </div>
    </li>
  );
}

function Meta({
  task,
  readOnly,
  attribution,
  clock,
}: {
  task: Task;
  readOnly?: boolean;
  attribution?: string;
  clock?: string | null;
}) {
  const chips: React.ReactNode[] = [];

  if (clock) {
    chips.push(
      <span key="clock" className="tabular-nums">
        {clock}
      </span>,
    );
  }

  // First, because it is what you scan for in a mixed list.
  if (attribution) {
    chips.push(
      <span key="attribution" className="font-semibold text-zinc-600 dark:text-zinc-300">
        {attribution}
      </span>,
    );
  }

  if (task.done) {
    chips.push(
      <span key="done" className="font-semibold text-emerald-700 dark:text-emerald-400">
        Done
      </span>,
    );
  }

  // Skipped wherever the row is attributed: a list that names who each task is
  // shared with is by definition a list of shared work, and "Looped in" on every
  // line of it is a sentence nobody needs to read nine times.
  if (attribution) {
    // the attribution already says it
  } else if (readOnly) {
    chips.push(
      <span key="looped" className="font-semibold text-sky-700 dark:text-sky-400">
        Looped in
      </span>,
    );
  } else if (task.shared_with_partner) {
    // So you can tell at a glance which of your tasks your partner sees.
    chips.push(
      <span
        key="shared"
        className="flex items-center gap-1 text-sky-600 dark:text-sky-400"
        title="Your partner can see this"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Looped in
      </span>,
    );
  }

  if (task.repeat_daily) {
    chips.push(
      <span key="daily" className="flex items-center gap-1" title="Repeats every day">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        Daily
      </span>,
    );
  }

  if (task.category) {
    chips.push(
      <span key="tag" className={`rounded-full px-2.5 py-0.5 font-semibold ${tagStyle(task.category)}`}>
        {task.category}
      </span>,
    );
  }

  if (chips.length === 0) return null;

  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-400 dark:text-zinc-500">
      {chips}
    </p>
  );
}
