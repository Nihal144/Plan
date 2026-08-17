/**
 * Shown when the day's exercises could not be read.
 *
 * The alternative is what this replaced: a failed query renders as "Nothing logged
 * yet", which reads as "you have not added anything" — so the exercises look lost
 * rather than unreachable, and the actual cause (an unapplied migration) never
 * surfaces. The same trap the category list already guards against.
 *
 * A missing column is called out by name because it has exactly one cause and one
 * fix, and the person reading this is the person who runs the migrations.
 */
export function LoadFailed({ message }: { message: string }) {
  const missingColumn = /column .* does not exist/i.test(message);

  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10"
    >
      <p className="font-semibold text-amber-900 dark:text-amber-200">
        Couldn&apos;t load this day&apos;s exercises.
      </p>
      <p className="text-amber-800 dark:text-amber-300/90">
        {missingColumn ? (
          <>
            The database is missing a column this page reads, so a migration in{" "}
            <code className="font-mono">supabase/migrations/</code> has not been run
            yet. Paste the newest ones into the Supabase SQL Editor.
          </>
        ) : (
          "Anything already logged is still saved — this is a read failure, not lost work."
        )}
      </p>
      <p className="font-mono text-xs text-amber-700 dark:text-amber-400/80">{message}</p>
    </div>
  );
}
