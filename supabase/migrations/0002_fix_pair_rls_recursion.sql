-- Fixes 42P17: "infinite recursion detected in policy for relation pair_members".
--
-- The original policies were self-referential:
--
--   pair_members SELECT USING (pair_id IN (SELECT pair_id FROM pair_members WHERE ...))
--
-- Evaluating that policy requires reading pair_members, which evaluates the policy
-- again, forever. `pairs` failed for the same reason, since its policy also read
-- pair_members. Both tables returned 500 on every query.
--
-- A SECURITY DEFINER function runs as its owner and therefore bypasses RLS on the
-- lookup, which breaks the cycle. It is still safe: it filters on auth.uid() and
-- can only ever return the caller's own pair, so it exposes nothing new.

create or replace function public.current_pair_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select pair_id from public.pair_members where user_id = auth.uid() limit 1;
$$;

revoke all on function public.current_pair_id() from public, anon;
grant execute on function public.current_pair_id() to authenticated;

drop policy if exists pair_members_select_own_pair on public.pair_members;
drop policy if exists pairs_select_own on public.pairs;

create policy pair_members_select_own_pair on public.pair_members
  for select using (pair_id = public.current_pair_id());

create policy pairs_select_own on public.pairs
  for select using (id = public.current_pair_id());
