-- Phase 1: profiles, rotating invite codes, pairing, per-user tasks.
--
-- Security model for the 4-digit code (only 10,000 values, enumerable in seconds):
--   1. Codes are single-use and expire in 15 minutes, so uniqueness is only ever
--      required among LIVE codes -- there is no 10,000-user cap.
--   2. No SELECT policy is granted on invite_codes. Redemption happens only through
--      redeem_invite_code(), which is SECURITY DEFINER. Without this, the REST API
--      would happily hand out every active code.
--   3. Redeeming creates a REQUEST, not a pair. The owner must accept.
--   4. Redemption attempts are rate limited, so spraying all 10,000 codes is not viable.
-- Each control is load-bearing; removing one materially weakens the others.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Holds LIVE codes only; rows are deleted on redemption or expiry. That is what
-- lets code values recycle. Note the unique index below cannot be made partial on
-- `expires_at > now()` -- Postgres requires immutable index predicates -- which is
-- precisely why expired rows are deleted rather than filtered.
create table public.invite_codes (
  id         uuid primary key default gen_random_uuid(),
  code       char(4) not null,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index invite_codes_code_key  on public.invite_codes (code);
create unique index invite_codes_owner_key on public.invite_codes (owner_id);

create table public.pair_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint pair_requests_not_self check (requester_id <> addressee_id)
);

-- Stops repeat submissions stacking up duplicate pending requests.
create unique index pair_requests_pending_key
  on public.pair_requests (requester_id, addressee_id)
  where status = 'pending';

create table public.pairs (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- A membership table rather than pairs(user_a, user_b): the UNIQUE on user_id is
-- what enforces "one partner at a time" in a single constraint. Two unique indexes
-- on a two-column table cannot express it -- a user could sit in user_a of one row
-- and user_b of another. This also generalises if groups ever exceed two.
create table public.pair_members (
  pair_id uuid not null references public.pairs (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  primary key (pair_id, user_id)
);

create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  text       text not null check (length(trim(text)) > 0),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index tasks_user_created_idx on public.tasks (user_id, created_at);

create table public.redemption_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index redemption_attempts_user_idx
  on public.redemption_attempts (user_id, attempted_at);

-- ---------------------------------------------------------------------------
-- Profile creation on signup
-- ---------------------------------------------------------------------------

-- A trigger rather than app code, so signing in and having a profile can never drift apart.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.invite_codes        enable row level security;
alter table public.pair_requests       enable row level security;
alter table public.pairs               enable row level security;
alter table public.pair_members        enable row level security;
alter table public.tasks               enable row level security;
alter table public.redemption_attempts enable row level security;

-- Own row only. Partner/requester names are exposed through the narrow DTO
-- functions below, so no policy here ever leaks another user's email.
create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Owners may read their own live code to display it. Deliberately NO policy that
-- allows lookup by code value -- that is what keeps the code space unenumerable
-- through the REST API. Writes happen only inside SECURITY DEFINER functions.
create policy invite_codes_select_own on public.invite_codes
  for select using (owner_id = (select auth.uid()));

create policy pair_requests_select_involved on public.pair_requests
  for select using (
    requester_id = (select auth.uid()) or addressee_id = (select auth.uid())
  );

-- Must be SECURITY DEFINER. A policy on pair_members cannot select from
-- pair_members directly -- doing so re-triggers the policy and Postgres raises
-- 42P17 (infinite recursion). Running as owner bypasses RLS for this lookup and
-- breaks the cycle; it stays safe because it filters on auth.uid() and can only
-- ever return the caller's own pair.
create function public.current_pair_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select pair_id from public.pair_members where user_id = auth.uid() limit 1;
$$;

create policy pair_members_select_own_pair on public.pair_members
  for select using (pair_id = public.current_pair_id());

create policy pairs_select_own on public.pairs
  for select using (id = public.current_pair_id());

-- THE PHASE-1 BOUNDARY. Tasks are owner-only with no partner exception, so
-- "paired profiles share nothing" is enforced by Postgres rather than by UI code.
-- Phase 2 relaxes exactly these four policies and nothing else.
create policy tasks_select_own on public.tasks
  for select using (user_id = (select auth.uid()));

create policy tasks_insert_own on public.tasks
  for insert with check (user_id = (select auth.uid()));

create policy tasks_update_own on public.tasks
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy tasks_delete_own on public.tasks
  for delete using (user_id = (select auth.uid()));

-- redemption_attempts intentionally has no policies: it is written and read only
-- by the SECURITY DEFINER function, so clients cannot clear their own rate limit.

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- search_path includes `extensions` because Supabase installs pgcrypto there, not
-- in public — with `set search_path = public` alone, gen_random_bytes() below is
-- unresolvable at runtime.
create function public.generate_invite_code()
returns table (code char(4), expires_at timestamptz)
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_code    char(4);
  v_expires timestamptz := now() + interval '15 minutes';
  v_bytes   bytea;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  if exists (select 1 from pair_members where user_id = v_uid) then
    raise exception 'You are already paired.' using errcode = 'P0001';
  end if;

  -- Reclaim globally expired codes and replace any existing code of the caller's,
  -- which is what keeps invite_codes_owner_key (one live code per person) satisfied.
  --
  -- Table-qualified deliberately: this function's RETURNS TABLE declares OUT
  -- params named `code` and `expires_at`, which shadow the columns of the same
  -- name and make a bare `where expires_at < now()` an ambiguous reference.
  delete from invite_codes ic where ic.expires_at < now() or ic.owner_id = v_uid;

  for i in 1 .. 50 loop
    v_bytes := gen_random_bytes(2);
    v_code  := lpad(((get_byte(v_bytes, 0) * 256 + get_byte(v_bytes, 1)) % 10000)::text, 4, '0');
    begin
      insert into invite_codes (code, owner_id, expires_at)
      values (v_code, v_uid, v_expires);

      code := v_code;
      expires_at := v_expires;
      return next;
      return;
    exception when unique_violation then
      -- Code is currently taken; loop and draw another.
    end;
  end loop;

  raise exception 'Could not allocate a code right now. Please try again.' using errcode = 'P0001';
end;
$$;

create function public.redeem_invite_code(p_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_owner      uuid;
  v_attempts   int;
  v_request_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  -- Rate limit is charged BEFORE the lookup, so wrong guesses cost the attacker
  -- their budget. Charging only on success would make brute force free.
  delete from redemption_attempts where attempted_at < now() - interval '1 hour';

  select count(*) into v_attempts
  from redemption_attempts
  where user_id = v_uid and attempted_at > now() - interval '15 minutes';

  if v_attempts >= 5 then
    raise exception 'Too many attempts. Try again in a few minutes.' using errcode = 'P0001';
  end if;

  insert into redemption_attempts (user_id) values (v_uid);

  if exists (select 1 from pair_members where user_id = v_uid) then
    raise exception 'You are already paired.' using errcode = 'P0001';
  end if;

  select owner_id into v_owner
  from invite_codes
  where code = p_code and expires_at > now();

  -- Same message for "wrong" and "expired" so the response cannot be used to
  -- distinguish a live code from a dead one.
  if v_owner is null then
    raise exception 'That code is invalid or has expired.' using errcode = 'P0001';
  end if;

  if v_owner = v_uid then
    raise exception 'That is your own code.' using errcode = 'P0001';
  end if;

  if exists (select 1 from pair_members where user_id = v_owner) then
    raise exception 'That code is invalid or has expired.' using errcode = 'P0001';
  end if;

  delete from invite_codes where code = p_code;  -- single use

  insert into pair_requests (requester_id, addressee_id)
  values (v_uid, v_owner)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create function public.respond_to_pair_request(p_request_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_req     public.pair_requests;
  v_pair_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  -- addressee_id = v_uid is the authorisation check: only the code's owner may respond.
  select * into v_req
  from pair_requests
  where id = p_request_id and addressee_id = v_uid and status = 'pending'
  for update;

  if not found then
    raise exception 'Request not found.' using errcode = 'P0001';
  end if;

  if not p_accept then
    update pair_requests set status = 'declined', responded_at = now()
    where id = p_request_id;
    return null;
  end if;

  -- Re-checked because either party may have paired while this request sat pending.
  if exists (select 1 from pair_members where user_id in (v_uid, v_req.requester_id)) then
    raise exception 'One of you is already paired.' using errcode = 'P0001';
  end if;

  insert into pairs default values returning id into v_pair_id;

  insert into pair_members (pair_id, user_id)
  values (v_pair_id, v_uid), (v_pair_id, v_req.requester_id);

  update pair_requests set status = 'accepted', responded_at = now()
  where id = p_request_id;

  -- Everything else involving either user is moot now that both are paired.
  update pair_requests set status = 'cancelled', responded_at = now()
  where status = 'pending'
    and id <> p_request_id
    and (requester_id in (v_uid, v_req.requester_id)
         or addressee_id in (v_uid, v_req.requester_id));

  delete from invite_codes where owner_id in (v_uid, v_req.requester_id);

  return v_pair_id;
end;
$$;

create function public.unpair()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_pair_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  select pair_id into v_pair_id from pair_members where user_id = v_uid;

  if v_pair_id is null then
    raise exception 'You are not paired.' using errcode = 'P0001';
  end if;

  delete from pairs where id = v_pair_id;  -- cascades to pair_members
end;
$$;

-- DTO functions: return only display fields, never the whole profile row. This is
-- why profiles keeps an own-row-only SELECT policy -- no other user's email is
-- reachable, even for someone you are paired with.

create function public.get_pair_status()
returns table (pair_id uuid, partner_id uuid, display_name text, avatar_url text)
language sql
stable
security definer set search_path = public
as $$
  select p.pair_id, p.user_id, pr.display_name, pr.avatar_url
  from pair_members me
  join pair_members p on p.pair_id = me.pair_id and p.user_id <> me.user_id
  join profiles pr on pr.id = p.user_id
  where me.user_id = auth.uid();
$$;

create function public.get_pending_requests()
returns table (request_id uuid, requester_id uuid, display_name text, avatar_url text,
               created_at timestamptz)
language sql
stable
security definer set search_path = public
as $$
  select r.id, r.requester_id, pr.display_name, pr.avatar_url, r.created_at
  from pair_requests r
  join profiles pr on pr.id = r.requester_id
  where r.addressee_id = auth.uid() and r.status = 'pending'
  order by r.created_at desc;
$$;

create function public.get_outgoing_request()
returns table (request_id uuid, addressee_id uuid, display_name text, status text,
               created_at timestamptz)
language sql
stable
security definer set search_path = public
as $$
  select r.id, r.addressee_id, pr.display_name, r.status, r.created_at
  from pair_requests r
  join profiles pr on pr.id = r.addressee_id
  where r.requester_id = auth.uid() and r.status = 'pending'
  order by r.created_at desc
  limit 1;
$$;

-- Execute is granted to authenticated users only; every function re-derives the
-- caller from auth.uid() rather than trusting any argument.
revoke all on function public.current_pair_id()                          from public, anon;
revoke all on function public.generate_invite_code()                     from public, anon;
revoke all on function public.redeem_invite_code(text)                   from public, anon;
revoke all on function public.respond_to_pair_request(uuid, boolean)     from public, anon;
revoke all on function public.unpair()                                   from public, anon;
revoke all on function public.get_pair_status()                          from public, anon;
revoke all on function public.get_pending_requests()                     from public, anon;
revoke all on function public.get_outgoing_request()                     from public, anon;

grant execute on function public.current_pair_id()                       to authenticated;
grant execute on function public.generate_invite_code()                  to authenticated;
grant execute on function public.redeem_invite_code(text)                to authenticated;
grant execute on function public.respond_to_pair_request(uuid, boolean)  to authenticated;
grant execute on function public.unpair()                                to authenticated;
grant execute on function public.get_pair_status()                       to authenticated;
grant execute on function public.get_pending_requests()                  to authenticated;
grant execute on function public.get_outgoing_request()                  to authenticated;
