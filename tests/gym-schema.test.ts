import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { migratedDb, setAuthUid, createUser } from "./helpers/db";
import { CATEGORY_SLUGS } from "@/lib/gym/types";

/**
 * Phase 1 deliverable: the migration applies, the seed lands, and one category's
 * pool reads back intact.
 */
describe("gym data layer", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await migratedDb("0007_gym.sql", "0008_skip_exercise.sql");
  });

  afterAll(async () => {
    await db.close();
  });

  it("seeds the seven categories in the specified order", async () => {
    const { rows } = await db.query<{ slug: string; name: string; sort_order: number }>(
      "select slug, name, sort_order from public.gym_categories order by sort_order",
    );

    expect(rows.map((r) => r.slug)).toEqual([...CATEGORY_SLUGS]);
    expect(rows.map((r) => r.name)).toEqual([
      "Push",
      "Pull",
      "Legs",
      "Shoulders",
      "Core",
      "Functional",
      "Cardio",
    ]);
  });

  it("seeds 10-14 exercises for every category", async () => {
    const { rows } = await db.query<{ slug: string; n: number }>(`
      select c.slug, count(p.id)::int as n
      from public.gym_categories c
      join public.gym_exercise_pool p on p.category_id = c.id
      group by c.slug
    `);

    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(row.n, `${row.slug} pool size`).toBeGreaterThanOrEqual(10);
      expect(row.n, `${row.slug} pool size`).toBeLessThanOrEqual(14);
    }
  });

  // The deliverable the phase asks for by name: seed, then read one back.
  it("reads back the Push pool with its defaults intact", async () => {
    const { rows } = await db.query<{
      name: string;
      default_sets: number | null;
      default_reps: number | null;
      metric_type: string;
    }>(
      `select p.name, p.default_sets, p.default_reps, p.metric_type
         from public.gym_exercise_pool p
         join public.gym_categories c on c.id = p.category_id
        where c.slug = 'push'
        order by p.name`,
    );

    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.every((r) => r.metric_type === "reps_weight")).toBe(true);

    const bench = rows.find((r) => r.name === "Barbell Bench Press");
    expect(bench).toEqual({
      name: "Barbell Bench Press",
      default_sets: 4,
      default_reps: 8,
      metric_type: "reps_weight",
    });
  });

  it("gives cardio only duration-based metrics", async () => {
    const { rows } = await db.query<{ metric_type: string }>(
      `select p.metric_type from public.gym_exercise_pool p
         join public.gym_categories c on c.id = p.category_id
        where c.slug = 'cardio'`,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(["duration", "distance_duration"]).toContain(row.metric_type);
    }
  });

  it("defaults new entries to not skipped", async () => {
    const userId = await createUser(db, "skip@example.com");
    await setAuthUid(db, userId);

    const { rows: cat } = await db.query<{ id: string }>(
      "select id from public.gym_categories where slug = 'legs'",
    );
    const { rows: day } = await db.query<{ get_or_create_workout_day: string }>(
      "select public.get_or_create_workout_day($1, $2)",
      [cat[0].id, "2026-08-21"],
    );

    const { rows } = await db.query<{ skipped: boolean; is_done: boolean }>(
      `insert into public.workout_entries
         (workout_day_id, user_id, exercise_name, source)
       values ($1, $2, 'Back Squat', 'manual')
       returning skipped, is_done`,
      [day[0].get_or_create_workout_day, userId],
    );

    expect(rows[0]).toEqual({ skipped: false, is_done: false });
  });

  it("re-running the migrations changes nothing", async () => {
    const before = await db.query<{ n: number }>(
      "select count(*)::int as n from public.gym_exercise_pool",
    );

    const fresh = await migratedDb(
      "0007_gym.sql",
      "0008_skip_exercise.sql",
      "0007_gym.sql",
      "0008_skip_exercise.sql",
    );
    const after = await fresh.query<{ n: number }>(
      "select count(*)::int as n from public.gym_exercise_pool",
    );
    await fresh.close();

    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  describe("workout days are created lazily and never duplicated", () => {
    it("returns the same id when called twice for one (user, category, date)", async () => {
      const userId = await createUser(db, "lazy@example.com");
      await setAuthUid(db, userId);

      const { rows: cat } = await db.query<{ id: string }>(
        "select id from public.gym_categories where slug = 'push'",
      );

      const first = await db.query<{ get_or_create_workout_day: string }>(
        "select public.get_or_create_workout_day($1, $2)",
        [cat[0].id, "2026-08-17"],
      );
      const second = await db.query<{ get_or_create_workout_day: string }>(
        "select public.get_or_create_workout_day($1, $2)",
        [cat[0].id, "2026-08-17"],
      );

      expect(first.rows[0].get_or_create_workout_day).toBe(
        second.rows[0].get_or_create_workout_day,
      );

      const { rows: count } = await db.query<{ n: number }>(
        "select count(*)::int as n from public.workout_days where user_id = $1",
        [userId],
      );
      expect(count[0].n).toBe(1);
    });

    it("keeps separate days per date and per category", async () => {
      const userId = await createUser(db, "multi@example.com");
      await setAuthUid(db, userId);

      const { rows: cats } = await db.query<{ id: string; slug: string }>(
        "select id, slug from public.gym_categories where slug in ('pull', 'legs') order by slug",
      );

      for (const cat of cats) {
        for (const date of ["2026-08-17", "2026-08-18"]) {
          await db.query("select public.get_or_create_workout_day($1, $2)", [cat.id, date]);
        }
      }

      const { rows } = await db.query<{ n: number }>(
        "select count(*)::int as n from public.workout_days where user_id = $1",
        [userId],
      );
      expect(rows[0].n).toBe(4);
    });

    it("refuses to create a day when nobody is signed in", async () => {
      await setAuthUid(db, null);
      const { rows: cat } = await db.query<{ id: string }>(
        "select id from public.gym_categories where slug = 'core'",
      );

      await expect(
        db.query("select public.get_or_create_workout_day($1, $2)", [cat[0].id, "2026-08-17"]),
      ).rejects.toThrow(/Not authenticated/);
    });
  });

  describe("entry constraints", () => {
    it("rejects an entry that claims done without a completed_at", async () => {
      const userId = await createUser(db, "constraint@example.com");
      await setAuthUid(db, userId);

      const { rows: cat } = await db.query<{ id: string }>(
        "select id from public.gym_categories where slug = 'push'",
      );
      const { rows: day } = await db.query<{ get_or_create_workout_day: string }>(
        "select public.get_or_create_workout_day($1, $2)",
        [cat[0].id, "2026-08-19"],
      );
      const dayId = day[0].get_or_create_workout_day;

      await expect(
        db.query(
          `insert into public.workout_entries
             (workout_day_id, user_id, exercise_name, source, is_done, completed_at)
           values ($1, $2, 'Push-Up', 'recommended', true, null)`,
          [dayId, userId],
        ),
      ).rejects.toThrow(/workout_entries_done_at_agrees/);
    });

    it("treats adding the same exercise twice as one row", async () => {
      const userId = await createUser(db, "idempotent@example.com");
      await setAuthUid(db, userId);

      const { rows: cat } = await db.query<{ id: string }>(
        "select id from public.gym_categories where slug = 'pull'",
      );
      const { rows: day } = await db.query<{ get_or_create_workout_day: string }>(
        "select public.get_or_create_workout_day($1, $2)",
        [cat[0].id, "2026-08-20"],
      );
      const dayId = day[0].get_or_create_workout_day;

      for (let i = 0; i < 2; i++) {
        await db.query(
          `insert into public.workout_entries
             (workout_day_id, user_id, exercise_name, source)
           values ($1, $2, 'Deadlift', 'recommended')
           on conflict (workout_day_id, exercise_name) do nothing`,
          [dayId, userId],
        );
      }

      const { rows } = await db.query<{ n: number }>(
        "select count(*)::int as n from public.workout_entries where workout_day_id = $1",
        [dayId],
      );
      expect(rows[0].n).toBe(1);
    });
  });
});
