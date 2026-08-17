import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * The phase-2 boundary change, tested as a boundary.
 *
 * 0009 widened the SELECT policy on `tasks` for the first time since 0001. This
 * exercises the real policy expression and the real `is_my_partner()` from the
 * migration file, against a Postgres with RLS actually enforced — the only way to
 * show that "partners see looped-in tasks and nothing else" is true rather than
 * merely intended.
 *
 * The surrounding tables are minimal stand-ins for 0001: that migration installs
 * pgcrypto and a trigger on `auth.users`, neither of which exists in PGlite. Only
 * the columns the policy actually reads are reproduced.
 */

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";
const CAROL = "33333333-3333-3333-3333-333333333333";

let db: PGlite;

/**
 * Runs a query as a given user with RLS actually enforced.
 *
 * `set role authenticated` is load-bearing: PGlite connects as a superuser, and
 * superusers bypass RLS unconditionally — `force row level security` does not
 * change that, it only covers the table owner. Without dropping to a plain role
 * every policy in this file would silently pass.
 */
async function asUser<T>(userId: string, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  await db.query("delete from auth.current_user_id");
  await db.query("insert into auth.current_user_id (id) values ($1)", [userId]);
  await db.exec("set role authenticated");
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();

  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;

    create table auth.current_user_id (id uuid);
    create function auth.uid() returns uuid language sql stable as $fn$
      select id from auth.current_user_id limit 1;
    $fn$;

    create table public.profiles (id uuid primary key, display_name text);

    create table public.pairs (id uuid primary key);
    create table public.pair_members (
      pair_id uuid not null references public.pairs (id) on delete cascade,
      user_id uuid not null unique references public.profiles (id) on delete cascade,
      primary key (pair_id, user_id)
    );

    -- Only the columns 0009's policy reads.
    create table public.tasks (
      id           uuid primary key default gen_random_uuid(),
      user_id      uuid not null references public.profiles (id) on delete cascade,
      text         text not null,
      done         boolean not null default false,
      scheduled_on date not null default current_date
    );
    alter table public.tasks enable row level security;

    create policy tasks_select_own on public.tasks
      for select using (user_id = (select auth.uid()));
    create policy tasks_insert_own on public.tasks
      for insert with check (user_id = (select auth.uid()));
    create policy tasks_update_own on public.tasks
      for update using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
    create policy tasks_delete_own on public.tasks
      for delete using (user_id = (select auth.uid()));

    -- Alice and Bob are partners. Carol is paired with nobody.
    insert into public.profiles (id, display_name)
      values ('${ALICE}', 'Alice'), ('${BOB}', 'Bob'), ('${CAROL}', 'Carol');
    insert into public.pairs (id) values ('44444444-4444-4444-4444-444444444444');
    insert into public.pair_members (pair_id, user_id) values
      ('44444444-4444-4444-4444-444444444444', '${ALICE}'),
      ('44444444-4444-4444-4444-444444444444', '${BOB}');
  `);

  // The migration under test, verbatim.
  const path = fileURLToPath(
    new URL("../supabase/migrations/0009_looped_tasks.sql", import.meta.url),
  );
  await db.exec(await readFile(path, "utf8"));

  // Two of Alice's tasks: one looped in, one private.
  await db.exec(`
    insert into public.tasks (user_id, text, shared_with_partner) values
      ('${ALICE}', 'Book the flights', true),
      ('${ALICE}', 'Therapy appointment', false);
  `);

  // The `authenticated` role is what Supabase runs signed-in requests as, and
  // what `asUser` drops to so the policies are actually evaluated.
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select on auth.current_user_id to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
});

afterAll(async () => {
  await db.close();
});

describe("looped-in tasks", () => {
  it("lets the owner see everything of their own", async () => {
    const { rows } = await asUser<{ text: string }>(
      ALICE,
      "select text from public.tasks order by text",
    );
    expect(rows.map((r) => r.text)).toEqual(["Book the flights", "Therapy appointment"]);
  });

  it("shows a partner only the looped-in task", async () => {
    const { rows } = await asUser<{ text: string }>(
      BOB,
      "select text from public.tasks order by text",
    );
    expect(rows.map((r) => r.text)).toEqual(["Book the flights"]);
  });

  // The whole point of the opt-in: applying 0009 must not retroactively expose
  // anything, and an unticked task stays as private as it was before.
  it("keeps the un-looped task invisible to the partner", async () => {
    const { rows } = await asUser<{ text: string }>(
      BOB,
      "select text from public.tasks where text = 'Therapy appointment'",
    );
    expect(rows).toHaveLength(0);
  });

  it("shows nothing to someone who is not the partner", async () => {
    const { rows } = await asUser(CAROL, "select text from public.tasks");
    expect(rows).toHaveLength(0);
  });

  describe("writes stay owner-only", () => {
    it("does not let a partner tick a looped-in task", async () => {
      await asUser(
        BOB,
        "update public.tasks set done = true where text = 'Book the flights'",
      );

      // The UPDATE policy matches no row for Bob, so this is a silent no-op
      // rather than an error — the row must be unchanged.
      const { rows } = await asUser<{ done: boolean }>(
        ALICE,
        "select done from public.tasks where text = 'Book the flights'",
      );
      expect(rows[0].done).toBe(false);
    });

    it("does not let a partner delete a looped-in task", async () => {
      await asUser(BOB, "delete from public.tasks where text = 'Book the flights'");

      const { rows } = await asUser(
        ALICE,
        "select id from public.tasks where text = 'Book the flights'",
      );
      expect(rows).toHaveLength(1);
    });

    it("does not let a partner create a task on someone else's behalf", async () => {
      await expect(
        asUser(
          BOB,
          `insert into public.tasks (user_id, text) values ('${ALICE}', 'Injected')`,
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  /**
   * What `getLoopedTasks` relies on: filtering on `shared_with_partner` alone
   * returns both directions of the loop in one query, because the policy already
   * limits the partner's side to what they opted in on. If that were not true the
   * DAL would need a user id in the query, and the split it does by owner would be
   * splitting the wrong set.
   */
  describe("both directions in one query", () => {
    beforeAll(async () => {
      await db.exec(`
        insert into public.tasks (user_id, text, shared_with_partner) values
          ('${BOB}', 'Pick up the ring', true),
          ('${BOB}', 'Dentist', false);
      `);
    });

    afterAll(async () => {
      await db.exec(`delete from public.tasks where user_id = '${BOB}'`);
    });

    it("returns the partner's shared task and your own, and nothing private", async () => {
      const { rows } = await asUser<{ text: string }>(
        BOB,
        "select text from public.tasks where shared_with_partner order by text",
      );

      // Alice's looped-in task and Bob's own. Not 'Therapy appointment' (Alice's,
      // private) and not 'Dentist' (Bob's own, but never opted in).
      expect(rows.map((r) => r.text)).toEqual(["Book the flights", "Pick up the ring"]);
    });

    it("still hides the partner's private task from the same query", async () => {
      const { rows } = await asUser<{ text: string }>(
        BOB,
        "select text from public.tasks where text = 'Therapy appointment'",
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe("is_my_partner", () => {
    it("is true only for the actual partner", async () => {
      const forBob = await asUser<{ r: boolean }>(
        ALICE,
        `select public.is_my_partner('${BOB}') as r`,
      );
      const forCarol = await asUser<{ r: boolean }>(
        ALICE,
        `select public.is_my_partner('${CAROL}') as r`,
      );
      const forSelf = await asUser<{ r: boolean }>(
        ALICE,
        `select public.is_my_partner('${ALICE}') as r`,
      );

      expect(forBob.rows[0].r).toBe(true);
      expect(forCarol.rows[0].r).toBe(false);
      // You are not your own partner — the join excludes the calling row.
      expect(forSelf.rows[0].r).toBe(false);
    });
  });
});
