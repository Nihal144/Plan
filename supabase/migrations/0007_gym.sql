-- Gym workout tracking: categories, an exercise pool, and per-day logs.
--
-- Phase 1 of the gym feature — the data layer only. Nothing here is user-visible
-- yet; later phases add the recommendation engine, the category grid and the day
-- view on top of exactly these tables.
--
-- Naming: the spec calls the columns `order` and `date`. `order` is a reserved
-- word in SQL and cannot be an unquoted identifier, so it is `sort_order`
-- throughout. `date` is only reserved as a type name and is legal as a column, so
-- it stays `date` to match the spec.
--
-- Idempotent: safe to re-run. The seed uses `on conflict do nothing` against real
-- unique constraints rather than a "have I run yet" flag.

begin;

-- ---------------------------------------------------------------------------
-- Reference data: categories and the exercise pool
-- ---------------------------------------------------------------------------
-- Both are global, not per-user: every user sees the same seven categories and
-- the same pool. Hence no user_id, and a read-only-to-clients RLS posture —
-- SELECT for any signed-in user, and no INSERT/UPDATE/DELETE policy at all, so
-- the pool cannot be edited through the REST API.

create table if not exists public.gym_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  icon       text not null,
  sort_order int  not null unique
);

create table if not exists public.gym_exercise_pool (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.gym_categories (id) on delete cascade,
  name         text not null,
  default_sets int,
  default_reps int,
  metric_type  text not null
                 check (metric_type in ('reps_weight', 'duration', 'distance_duration')),
  -- Both the natural key for the idempotent seed below and the guard against a
  -- category listing the same exercise twice.
  unique (category_id, name)
);

create index if not exists gym_exercise_pool_category_idx
  on public.gym_exercise_pool (category_id, name);

-- ---------------------------------------------------------------------------
-- Per-user logs
-- ---------------------------------------------------------------------------

-- Created lazily on first interaction. The unique key is what makes that safe to
-- retry: two concurrent "add exercise" clicks both resolve to the same day row
-- rather than racing to create two.
create table if not exists public.workout_days (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.gym_categories (id) on delete cascade,
  date        date not null,
  day_note    text,
  created_at  timestamptz not null default now(),
  unique (user_id, category_id, date)
);

create index if not exists workout_days_user_date_idx
  on public.workout_days (user_id, date);

create table if not exists public.workout_entries (
  id             uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references public.workout_days (id) on delete cascade,
  -- Denormalised so RLS can filter without joining workout_days on every row.
  user_id        uuid not null references public.profiles (id) on delete cascade,
  exercise_name  text not null check (length(trim(exercise_name)) > 0),
  source         text not null check (source in ('recommended', 'manual')),
  sets           int,
  reps           int,
  weight         numeric(6, 2),
  duration       int,             -- seconds
  distance       numeric(7, 2),   -- metres
  note           text,
  is_done        boolean not null default false,
  completed_at   timestamptz,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  -- Makes "add this exercise" idempotent: clicking Add twice cannot produce two
  -- rows for the same exercise on the same day.
  unique (workout_day_id, exercise_name),
  -- is_done and completed_at must agree. Without this they drift, and "done"
  -- becomes two sources of truth that disagree.
  constraint workout_entries_done_at_agrees
    check ((is_done and completed_at is not null) or (not is_done and completed_at is null))
);

create index if not exists workout_entries_day_idx
  on public.workout_entries (workout_day_id, sort_order, created_at);

-- A dismissed recommendation. Scoped to one day: dismissing "Push-Up" today says
-- nothing about tomorrow, and never touches the pool.
create table if not exists public.workout_dismissals (
  workout_day_id uuid not null references public.workout_days (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  exercise_name  text not null,
  created_at     timestamptz not null default now(),
  primary key (workout_day_id, exercise_name)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.gym_categories     enable row level security;
alter table public.gym_exercise_pool  enable row level security;
alter table public.workout_days       enable row level security;
alter table public.workout_entries    enable row level security;
alter table public.workout_dismissals enable row level security;

-- Reference data: readable by any signed-in user, writable by none.
drop policy if exists gym_categories_select on public.gym_categories;
create policy gym_categories_select on public.gym_categories
  for select to authenticated using (true);

drop policy if exists gym_exercise_pool_select on public.gym_exercise_pool;
create policy gym_exercise_pool_select on public.gym_exercise_pool
  for select to authenticated using (true);

-- User data: the same owner-only boundary as `tasks`.
drop policy if exists workout_days_select_own on public.workout_days;
create policy workout_days_select_own on public.workout_days
  for select using (user_id = (select auth.uid()));

drop policy if exists workout_days_insert_own on public.workout_days;
create policy workout_days_insert_own on public.workout_days
  for insert with check (user_id = (select auth.uid()));

drop policy if exists workout_days_update_own on public.workout_days;
create policy workout_days_update_own on public.workout_days
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists workout_days_delete_own on public.workout_days;
create policy workout_days_delete_own on public.workout_days
  for delete using (user_id = (select auth.uid()));

-- Entries and dismissals additionally verify the parent day belongs to the
-- caller, so a crafted request cannot attach rows to someone else's workout.
drop policy if exists workout_entries_select_own on public.workout_entries;
create policy workout_entries_select_own on public.workout_entries
  for select using (user_id = (select auth.uid()));

drop policy if exists workout_entries_insert_own on public.workout_entries;
create policy workout_entries_insert_own on public.workout_entries
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_days d
      where d.id = workout_day_id and d.user_id = (select auth.uid())
    )
  );

drop policy if exists workout_entries_update_own on public.workout_entries;
create policy workout_entries_update_own on public.workout_entries
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists workout_entries_delete_own on public.workout_entries;
create policy workout_entries_delete_own on public.workout_entries
  for delete using (user_id = (select auth.uid()));

drop policy if exists workout_dismissals_select_own on public.workout_dismissals;
create policy workout_dismissals_select_own on public.workout_dismissals
  for select using (user_id = (select auth.uid()));

drop policy if exists workout_dismissals_insert_own on public.workout_dismissals;
create policy workout_dismissals_insert_own on public.workout_dismissals
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_days d
      where d.id = workout_day_id and d.user_id = (select auth.uid())
    )
  );

drop policy if exists workout_dismissals_delete_own on public.workout_dismissals;
create policy workout_dismissals_delete_own on public.workout_dismissals
  for delete using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Lazy day creation
-- ---------------------------------------------------------------------------
-- One statement, so concurrent callers cannot both decide the row is missing.
-- `on conflict do nothing` returns no row, hence the trailing select — the
-- standard get-or-create shape. SECURITY INVOKER (the default): RLS still
-- applies, and the caller is resolved from auth.uid() rather than an argument.

create or replace function public.get_or_create_workout_day(
  p_category_id uuid,
  p_date        date
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  insert into workout_days (user_id, category_id, date)
  values (v_uid, p_category_id, p_date)
  on conflict (user_id, category_id, date) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from workout_days
    where user_id = v_uid and category_id = p_category_id and date = p_date;
  end if;

  return v_id;
end;
$$;

revoke all on function public.get_or_create_workout_day(uuid, date) from public, anon;
grant execute on function public.get_or_create_workout_day(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: seven categories
-- ---------------------------------------------------------------------------

insert into public.gym_categories (name, slug, icon, sort_order) values
  ('Push',       'push',       'push',       1),
  ('Pull',       'pull',       'pull',       2),
  ('Legs',       'legs',       'legs',       3),
  ('Shoulders',  'shoulders',  'shoulders',  4),
  ('Core',       'core',       'core',       5),
  ('Functional', 'functional', 'functional', 6),
  ('Cardio',     'cardio',     'cardio',     7)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: the exercise pool
-- ---------------------------------------------------------------------------
-- Joined to the category by slug so this block does not depend on generated ids.
-- sets/reps are null wherever the metric type makes them meaningless.

insert into public.gym_exercise_pool (category_id, name, default_sets, default_reps, metric_type)
select c.id, e.name, e.sets, e.reps, e.metric
from (values
  -- Push
  ('push', 'Barbell Bench Press',        4, 8,  'reps_weight'),
  ('push', 'Incline Dumbbell Press',     3, 10, 'reps_weight'),
  ('push', 'Machine Chest Press',        3, 10, 'reps_weight'),
  ('push', 'Push-Up',                    3, 15, 'reps_weight'),
  ('push', 'Cable Chest Fly',            3, 12, 'reps_weight'),
  ('push', 'Dumbbell Chest Fly',         3, 12, 'reps_weight'),
  ('push', 'Dips',                       3, 10, 'reps_weight'),
  ('push', 'Close-Grip Bench Press',     3, 8,  'reps_weight'),
  ('push', 'Triceps Pushdown',           3, 12, 'reps_weight'),
  ('push', 'Overhead Triceps Extension', 3, 12, 'reps_weight'),
  ('push', 'Skull Crusher',              3, 10, 'reps_weight'),
  ('push', 'Decline Bench Press',        3, 8,  'reps_weight'),

  -- Pull
  ('pull', 'Deadlift',                   4, 5,  'reps_weight'),
  ('pull', 'Pull-Up',                    3, 8,  'reps_weight'),
  ('pull', 'Chin-Up',                    3, 8,  'reps_weight'),
  ('pull', 'Lat Pulldown',               3, 10, 'reps_weight'),
  ('pull', 'Barbell Row',                4, 8,  'reps_weight'),
  ('pull', 'Dumbbell Row',               3, 10, 'reps_weight'),
  ('pull', 'Seated Cable Row',           3, 12, 'reps_weight'),
  ('pull', 'Face Pull',                  3, 15, 'reps_weight'),
  ('pull', 'Straight-Arm Pulldown',      3, 12, 'reps_weight'),
  ('pull', 'Barbell Curl',               3, 10, 'reps_weight'),
  ('pull', 'Hammer Curl',                3, 12, 'reps_weight'),
  ('pull', 'Preacher Curl',              3, 12, 'reps_weight'),

  -- Legs
  ('legs', 'Back Squat',                 4, 8,  'reps_weight'),
  ('legs', 'Front Squat',                3, 8,  'reps_weight'),
  ('legs', 'Goblet Squat',               3, 12, 'reps_weight'),
  ('legs', 'Romanian Deadlift',          3, 10, 'reps_weight'),
  ('legs', 'Leg Press',                  3, 12, 'reps_weight'),
  ('legs', 'Walking Lunge',              3, 12, 'reps_weight'),
  ('legs', 'Bulgarian Split Squat',      3, 10, 'reps_weight'),
  ('legs', 'Hip Thrust',                 3, 10, 'reps_weight'),
  ('legs', 'Leg Extension',              3, 15, 'reps_weight'),
  ('legs', 'Lying Leg Curl',             3, 12, 'reps_weight'),
  ('legs', 'Standing Calf Raise',        4, 15, 'reps_weight'),
  ('legs', 'Seated Calf Raise',          3, 15, 'reps_weight'),

  -- Shoulders
  ('shoulders', 'Overhead Press',        4, 8,  'reps_weight'),
  ('shoulders', 'Seated Dumbbell Press', 3, 10, 'reps_weight'),
  ('shoulders', 'Arnold Press',          3, 10, 'reps_weight'),
  ('shoulders', 'Landmine Press',        3, 10, 'reps_weight'),
  ('shoulders', 'Lateral Raise',         3, 15, 'reps_weight'),
  ('shoulders', 'Cable Lateral Raise',   3, 15, 'reps_weight'),
  ('shoulders', 'Front Raise',           3, 12, 'reps_weight'),
  ('shoulders', 'Rear Delt Fly',         3, 15, 'reps_weight'),
  ('shoulders', 'Reverse Pec Deck',      3, 15, 'reps_weight'),
  ('shoulders', 'Upright Row',           3, 12, 'reps_weight'),
  ('shoulders', 'Barbell Shrug',         3, 12, 'reps_weight'),
  ('shoulders', 'Pike Push-Up',          3, 10, 'reps_weight'),

  -- Core
  ('core', 'Plank',                      3, null, 'duration'),
  ('core', 'Side Plank',                 3, null, 'duration'),
  ('core', 'Hollow Body Hold',           3, null, 'duration'),
  ('core', 'Dead Bug',                   3, 12,  'reps_weight'),
  ('core', 'Hanging Leg Raise',          3, 12,  'reps_weight'),
  ('core', 'Toes to Bar',                3, 10,  'reps_weight'),
  ('core', 'Cable Crunch',               3, 15,  'reps_weight'),
  ('core', 'Bicycle Crunch',             3, 20,  'reps_weight'),
  ('core', 'Russian Twist',              3, 20,  'reps_weight'),
  ('core', 'Ab Wheel Rollout',           3, 10,  'reps_weight'),
  ('core', 'V-Up',                       3, 15,  'reps_weight'),
  ('core', 'Mountain Climber',           3, null, 'duration'),

  -- Functional
  ('functional', 'Kettlebell Swing',     4, 15,  'reps_weight'),
  ('functional', 'Turkish Get-Up',       3, 5,   'reps_weight'),
  ('functional', 'Thruster',             4, 10,  'reps_weight'),
  ('functional', 'Wall Ball',            3, 15,  'reps_weight'),
  ('functional', 'Medicine Ball Slam',   3, 12,  'reps_weight'),
  ('functional', 'Box Jump',             4, 10,  'reps_weight'),
  ('functional', 'Burpee',               3, 12,  'reps_weight'),
  ('functional', 'Clean and Press',      4, 6,   'reps_weight'),
  ('functional', 'Battle Ropes',         3, null, 'duration'),
  ('functional', 'Bear Crawl',           3, null, 'duration'),
  ('functional', 'Farmer''s Carry',      3, null, 'distance_duration'),
  ('functional', 'Sled Push',            4, null, 'distance_duration'),

  -- Cardio
  ('cardio', 'Treadmill Run',            null, null, 'distance_duration'),
  ('cardio', 'Outdoor Run',              null, null, 'distance_duration'),
  ('cardio', 'Sprint Intervals',         null, null, 'duration'),
  ('cardio', 'Incline Walk',             null, null, 'duration'),
  ('cardio', 'Cycling',                  null, null, 'distance_duration'),
  ('cardio', 'Assault Bike',             null, null, 'duration'),
  ('cardio', 'Rowing Machine',           null, null, 'distance_duration'),
  ('cardio', 'Elliptical',               null, null, 'duration'),
  ('cardio', 'Stair Climber',            null, null, 'duration'),
  ('cardio', 'Swimming',                 null, null, 'distance_duration'),
  ('cardio', 'Jump Rope',                null, null, 'duration'),
  ('cardio', 'Hiking',                   null, null, 'distance_duration')
) as e(slug, name, sets, reps, metric)
join public.gym_categories c on c.slug = e.slug
on conflict (category_id, name) do nothing;

commit;
