-- Drops priority, adds a daily-repeat flag, and moves completion to its own table.
--
-- Why completion moves: a repeating task is one row that appears on many days.
-- With a boolean `done` on that row, ticking it off on Monday would show it done
-- on Tuesday too. Completion is a fact about (task, day), not about the task.
--
-- Non-repeating tasks use the same mechanism rather than keeping `done` around
-- for them, so there is one code path instead of two.

alter table public.tasks drop column priority;

alter table public.tasks
  add column repeat_daily boolean not null default false;

create table public.task_completions (
  task_id      uuid not null references public.tasks (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  day          date not null,
  completed_at timestamptz not null default now(),
  primary key (task_id, day)
);

create index task_completions_user_day_idx
  on public.task_completions (user_id, day);

alter table public.task_completions enable row level security;

-- Same owner-only boundary as `tasks`; phase 2 relaxes these alongside it.
create policy task_completions_select_own on public.task_completions
  for select using (user_id = (select auth.uid()));

create policy task_completions_insert_own on public.task_completions
  for insert with check (user_id = (select auth.uid()));

create policy task_completions_delete_own on public.task_completions
  for delete using (user_id = (select auth.uid()));

-- Preserve what is already ticked off before the column disappears.
insert into public.task_completions (task_id, user_id, day)
select id, user_id, scheduled_on from public.tasks where done
on conflict do nothing;

alter table public.tasks drop column done;

-- A repeating task is matched by scheduled_on <= day, so the day index no longer
-- needs the time column leading.
drop index if exists tasks_user_day_idx;
create index tasks_user_repeat_idx on public.tasks (user_id, repeat_daily, scheduled_on);
