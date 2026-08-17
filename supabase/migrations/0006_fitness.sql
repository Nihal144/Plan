-- Typed tasks, and fitness sub-tasks.
--
-- A task now has a `kind`. Ticking "Fitness" when adding one marks it as a fitness
-- task: it renders orange in the day's list and opens a Fitness view for that day
-- where it carries its own list of sub-tasks.
--
-- `kind` is a checked text column rather than an `is_fitness` boolean so a third
-- type costs a check-constraint edit instead of another boolean. `priority` in 0003
-- is the precedent for the shape (and 0004 dropping it is the precedent for pulling
-- one back out again).
--
-- Sub-tasks get their own table rather than a self-referencing `parent_id` on
-- `tasks`. getTasksForDay() and getWeekCounts() deliberately query `tasks` with no
-- filter beyond the day rules — RLS is the boundary, not the query — so a child row
-- in that table would immediately leak into every day list, every week-strip dot and
-- the Home progress ring, unless all of them (and every future query) remembered to
-- exclude it. A sub-task also has no schedule, time, category or repeat, so most of
-- `tasks` would be dead columns for it.
--
-- Idempotent: safe to re-run.

begin;

alter table public.tasks
  add column if not exists kind text not null default 'general'
    check (kind in ('general', 'fitness'));

create table if not exists public.fitness_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  text       text not null check (length(trim(text)) > 0),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

-- Reads are always "every item for these task ids, oldest first".
create index if not exists fitness_items_task_idx
  on public.fitness_items (task_id, created_at);

alter table public.fitness_items enable row level security;

-- Same owner-only boundary as `tasks`; phase 2 relaxes these alongside it.
-- Dropped and recreated rather than guarded, so the script is re-runnable.
drop policy if exists fitness_items_select_own on public.fitness_items;
create policy fitness_items_select_own on public.fitness_items
  for select using (user_id = (select auth.uid()));

-- `user_id = auth.uid()` alone proves who is writing but not what they are writing
-- against — without the exists(), a crafted request could hang items off another
-- user's task, or off a task that is not a fitness task at all.
drop policy if exists fitness_items_insert_own on public.fitness_items;
create policy fitness_items_insert_own on public.fitness_items
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and t.user_id = (select auth.uid())
        and t.kind = 'fitness'
    )
  );

drop policy if exists fitness_items_update_own on public.fitness_items;
create policy fitness_items_update_own on public.fitness_items
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists fitness_items_delete_own on public.fitness_items;
create policy fitness_items_delete_own on public.fitness_items
  for delete using (user_id = (select auth.uid()));

commit;
