/**
 * Gym domain models, mirroring `supabase/migrations/0007_gym.sql`.
 *
 * Hand-written because the repo has no generated Supabase types (see `dal.ts`).
 * Column names match the database exactly — `sort_order` rather than `order`,
 * which is a reserved word in SQL.
 */

/** How an exercise is measured, and therefore which inputs the UI shows. */
export type MetricType = "reps_weight" | "duration" | "distance_duration";

/** Whether an entry came from a recommendation or was typed in by hand. */
export type EntrySource = "recommended" | "manual";

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
};

export type PoolExercise = {
  id: string;
  category_id: string;
  name: string;
  default_sets: number | null;
  default_reps: number | null;
  metric_type: MetricType;
};

export type WorkoutDay = {
  id: string;
  user_id: string;
  category_id: string;
  date: string;
  day_note: string | null;
  created_at: string;
};

export type WorkoutEntry = {
  id: string;
  workout_day_id: string;
  user_id: string;
  exercise_name: string;
  source: EntrySource;
  sets: number | null;
  reps: number | null;
  /** Kilograms. */
  weight: number | null;
  /** Seconds. */
  duration: number | null;
  /** Metres. */
  distance: number | null;
  note: string | null;
  is_done: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
};

export type WorkoutDismissal = {
  workout_day_id: string;
  user_id: string;
  exercise_name: string;
  created_at: string;
};

/** The seven categories, in fixed display order. Mirrors the seed in 0007. */
export const CATEGORY_SLUGS = [
  "push",
  "pull",
  "legs",
  "shoulders",
  "core",
  "functional",
  "cardio",
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];
