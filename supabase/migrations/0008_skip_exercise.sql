-- Skipping an exercise.
--
-- Distinct from removing it: a removed exercise was never part of the session,
-- while a skipped one was planned and deliberately passed on. That matters for
-- day completion — a skipped exercise must not hold the day open forever, or the
-- Fitness task can never tick when you drop the last set.
--
-- A boolean rather than a status enum: `is_done` already exists as a boolean, and
-- the two are independent (skipping clears done, but the states are set by
-- different actions and read separately).
--
-- Idempotent: safe to re-run.

begin;

alter table public.workout_entries
  add column if not exists skipped boolean not null default false;

-- Outstanding work first, then skipped, then finished. Matches the order the day
-- view renders, so the sort is one index rather than an in-memory pass.
drop index if exists public.workout_entries_day_idx;
create index if not exists workout_entries_day_idx
  on public.workout_entries (workout_day_id, is_done, skipped, sort_order, created_at);

commit;
