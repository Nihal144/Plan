-- Scheduling, categories and priority for tasks.
--
-- scheduled_on is a `date` and scheduled_time a plain `time`, deliberately not a
-- single timestamptz. A planner entry is wall-clock ("09:30 on Wed the 15th"),
-- not an instant: if the user flies to another timezone their 9:30am task should
-- stay at 9:30am. Splitting the columns also keeps day-filtering a simple equality
-- instead of a timezone-dependent range.

alter table public.tasks
  add column scheduled_on   date not null default current_date,
  add column scheduled_time time,
  add column category       text,
  add column priority       text not null default 'medium'
                              check (priority in ('low', 'medium', 'high'));

-- Existing rows predate scheduling; land them on the day they were created so
-- nothing silently disappears from the new date-filtered view.
update public.tasks set scheduled_on = created_at::date;

drop index if exists tasks_user_created_idx;
create index tasks_user_day_idx on public.tasks (user_id, scheduled_on, scheduled_time);
