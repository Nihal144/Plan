-- How long a task takes.
--
-- Distinct from `scheduled_time`, which is when it starts: the timeline shows
-- "06:30" in the gutter and "1 hr 20 mins" under the title, and neither can be
-- derived from the other. Nullable, because most tasks are a line on a day rather
-- than a block with a length — an unset duration renders nothing at all.
--
-- Minutes rather than an interval: every read formats it for display and no query
-- does arithmetic across rows, so an integer avoids parsing `interval` on the way
-- out for no gain.
--
-- Bounded at 24h. A task longer than the day it sits on is a data-entry slip
-- (a stray zero), and the constraint catches it at the boundary rather than
-- letting "600 hrs" render in the card.
--
-- Idempotent: safe to re-run.

begin;

alter table public.tasks
  add column if not exists duration_minutes integer
    check (duration_minutes is null or (duration_minutes > 0 and duration_minutes <= 1440));

commit;
