-- Looping a partner in on a task.
--
-- This is the phase-2 boundary change 0001 anticipated: "Tasks are owner-only
-- with no partner exception. Phase 2 relaxes exactly these four policies and
-- nothing else." In fact only ONE of the four moves here — SELECT.
--
-- INSERT, UPDATE and DELETE stay strictly owner-only, so a looped-in partner can
-- see the task and nothing more. They cannot tick it, edit it or delete it, and
-- that is enforced by Postgres rather than by hiding buttons.
--
-- Opt-in per task, never per account: `shared_with_partner` defaults to false, so
-- applying this migration shares nothing that existed before it.
--
-- Idempotent: safe to re-run.

begin;

alter table public.tasks
  add column if not exists shared_with_partner boolean not null default false;

-- Must be SECURITY DEFINER for the same reason current_pair_id() is (see 0002):
-- a policy on `tasks` that reads `pair_members` would evaluate pair_members'
-- own policy, and the lookup needs to see both rows of the pair regardless.
-- It stays safe because it resolves the caller from auth.uid() and can only ever
-- answer "is this specific user paired with me?" — it returns no data.
create or replace function public.is_my_partner(p_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from pair_members me
    join pair_members them
      on them.pair_id = me.pair_id and them.user_id <> me.user_id
    where me.user_id = auth.uid()
      and them.user_id = p_user_id
  );
$$;

revoke all on function public.is_my_partner(uuid) from public, anon;
grant execute on function public.is_my_partner(uuid) to authenticated;

-- The one relaxed policy. Note the ordering: `shared_with_partner` is checked
-- first so the function is only called for tasks that opted in.
drop policy if exists tasks_select_own on public.tasks;
drop policy if exists tasks_select_own_or_looped on public.tasks;
create policy tasks_select_own_or_looped on public.tasks
  for select using (
    user_id = (select auth.uid())
    or (shared_with_partner and public.is_my_partner(user_id))
  );

-- Left untouched, and deliberately so: writes remain owner-only.
--   tasks_insert_own, tasks_update_own, tasks_delete_own

-- Partner reads filter on this pair of columns, so they lead the index.
create index if not exists tasks_shared_idx
  on public.tasks (shared_with_partner, user_id, scheduled_on)
  where shared_with_partner;

commit;
