import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * A real Postgres to run migrations against, in-process via WASM.
 *
 * The alternative is mocking the database, which would verify only that the mock
 * agrees with itself — a seed and a set of constraints are exactly the things a
 * mock cannot check. PGlite runs the actual migration file, so a syntax error, a
 * violated constraint or a miscounted seed row fails the test.
 */
export async function migratedDb(...migrations: string[]): Promise<PGlite> {
  const db = new PGlite();

  // Supabase supplies these in a hosted project; PGlite is a bare Postgres, so
  // the migration's references to them have to resolve to something.
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema if not exists auth;

    -- Overridden per-test by set_auth_uid(); null means "not signed in".
    create table auth.current_user_id (id uuid);
    create function auth.uid() returns uuid language sql stable as $fn$
      select id from auth.current_user_id limit 1;
    $fn$;

    create table public.profiles (
      id           uuid primary key default gen_random_uuid(),
      email        text,
      display_name text,
      created_at   timestamptz not null default now()
    );
  `);

  for (const name of migrations) {
    const path = fileURLToPath(
      new URL(`../../supabase/migrations/${name}`, import.meta.url),
    );
    await db.exec(await readFile(path, "utf8"));
  }

  return db;
}

/** Points auth.uid() at a user, the way a signed-in request would. */
export async function setAuthUid(db: PGlite, userId: string | null) {
  await db.query("delete from auth.current_user_id");
  if (userId) {
    await db.query("insert into auth.current_user_id (id) values ($1)", [userId]);
  }
}

/** Creates a profile row and returns its id. */
export async function createUser(db: PGlite, email = "test@example.com") {
  const result = await db.query<{ id: string }>(
    "insert into public.profiles (email) values ($1) returning id",
    [email],
  );
  return result.rows[0].id;
}
