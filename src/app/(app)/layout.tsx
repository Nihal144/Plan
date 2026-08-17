import { signOut } from "@/app/actions/auth";
import { SidebarNav } from "./sidebar-nav";
import { BottomNav } from "./bottom-nav";

/**
 * Shell only — no auth check here. Layouts don't re-render on navigation and
 * don't control whether sibling segments render, so each page calls
 * requireUser() itself (see the Next 16 auth guide).
 *
 * Two navigations, one source of truth (`@/lib/nav`): an icon rail on desktop,
 * a pinned tab bar on mobile. Sign-out lives in the rail on desktop and on the
 * Home page on mobile, so the tab bar stays at exactly three destinations.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh bg-[#e6ebf1] dark:bg-[#0a0c10] lg:p-6">
      <div className="flex min-h-dvh bg-white lg:min-h-[calc(100dvh-3rem)] lg:overflow-hidden lg:rounded-[28px] lg:bg-[#16181d] dark:bg-[#12141a] dark:lg:bg-[#16181d]">
        <aside className="hidden w-[88px] shrink-0 flex-col items-center justify-between py-6 lg:flex">
          <div className="flex flex-col items-center gap-8">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf5cf]"
              aria-hidden="true"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#16181d"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 17l6-6 4 4 7-7" />
                <path d="M15 8h5v5" />
              </svg>
            </div>
            <SidebarNav />
          </div>

          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
                <path d="M10 17l-5-5 5-5M5 12h11" />
              </svg>
            </button>
          </form>
        </aside>

        {/* pb-24 clears the fixed tab bar on mobile; the rail replaces it at lg. */}
        <main className="min-w-0 flex-1 bg-white pb-24 dark:bg-[#12141a] lg:my-2 lg:mr-2 lg:rounded-[22px] lg:pb-0">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
