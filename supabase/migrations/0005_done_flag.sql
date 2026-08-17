-- Reverses 0004's completion model: `done` is a boolean on the task again, and
-- task_completions is gone.
--
-- 0004 moved completion to a (task, day) table so a repeating task ticked off on
-- Monday would still be outstanding on Tuesday. That is deliberately given up here:
-- completion is now a fact about the task, so ticking a daily repeat marks it done
-- on every day it appears. Simpler model, and one row per task to reason about.
--
-- Idempotent, and written to land the same end state from any earlier point:
-- 0002 (no scheduling at all), 0003, a half-applied 0004 (repeat_daily added by
-- hand, `done` never dropped), or a fully-applied 0004.

begin;

-- ---------------------------------------------------------------------------
-- 0003: scheduling columns
-- ---------------------------------------------------------------------------
-- scheduled_on is a `date` and scheduled_time a plain `time`, deliberately not a
-- single timestamptz. A planner entry is wall-clock ("09:30 on Wed the 15th"), not
-- an instant: if the user flies to another timezone their 9:30am task should stay
-- at 9:30am. Splitting the columns also keeps day-filtering a simple equality
-- instead of a timezone-dependent range.

-- Added nullable first, backfilled, then constrained. Adding it as
-- `not null default current_date` in one statement would stamp every existing row
-- with today instead of the day it was created.
alter table public.tasks add column if not exists scheduled_on   date;
alter table public.tasks add column if not exists scheduled_time time;
alter table public.tasks add column if not exists category       text;

update public.tasks set scheduled_on = created_at::date where scheduled_on is null;

alter table public.tasks
  alter column scheduled_on set default current_date,
  alter column scheduled_on set not null;

-- ---------------------------------------------------------------------------
-- The repeat flag
-- ---------------------------------------------------------------------------

-- `not null default false` is what makes every inserted task carry an explicit
-- true/false, including any row written before this column existed.
alter table public.tasks add column if not exists repeat_daily boolean not null default false;

-- 0003 introduced `priority`; it never reached the UI.
alter table public.tasks drop column if exists priority;

-- ---------------------------------------------------------------------------
-- Completion, back on the task
-- ---------------------------------------------------------------------------

alter table public.tasks add column if not exists done boolean not null default false;

-- Fold any existing per-day completions back into the flag before dropping them.
-- A task ticked off on any single day counts as done outright — that is the whole
-- point of the model change, and it is a one-way door for that history.
do $$
begin
  if to_regclass('public.task_completions') is not null then
    update public.tasks t
       set done = true
     where exists (select 1 from public.task_completions c where c.task_id = t.id);

    drop table public.task_completions;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- A repeating task is matched by scheduled_on <= day, so the day index does not
-- need the time column leading.

drop index if exists public.tasks_user_created_idx;
drop index if exists public.tasks_user_day_idx;

create index if not exists tasks_user_repeat_idx
  on public.tasks (user_id, repeat_daily, scheduled_on);

commit;
