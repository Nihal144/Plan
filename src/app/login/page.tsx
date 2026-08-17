import { signInWithGoogle } from "@/app/actions/auth";

const ERRORS: Record<string, string> = {
  missing_code: "Sign-in was cancelled. Please try again.",
  exchange_failed: "We couldn't complete sign-in. Please try again.",
  oauth_failed: "Couldn't reach Google. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center p-5">
      <div className="w-full max-w-[400px] rounded-2xl bg-white p-9 text-center shadow-[0_1px_2px_rgba(16,24,40,0.05),0_8px_24px_rgba(16,24,40,0.08)] dark:bg-zinc-900">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">The Plan</h1>
        <p className="mb-7 text-zinc-500 dark:text-zinc-400">
          Sign in to keep your tasks in sync.
        </p>

        {message && (
          <p
            role="alert"
            className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {message}
          </p>
        )}

        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-5 py-3 font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
              />
              <path
                fill="#FBBC05"
                d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3-2.33Z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
              />
            </svg>
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
