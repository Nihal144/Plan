"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "@/lib/nav";

/**
 * Mobile tab bar, pinned to the bottom of the viewport.
 *
 * `fixed` + `dvh`-based layout rather than `sticky`, so the bar stays put when
 * mobile browser chrome shows and hides. The safe-area inset keeps it clear of
 * the iOS home indicator; the layout adds matching bottom padding to the main
 * region so content is never trapped underneath.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur-sm lg:hidden dark:border-zinc-800 dark:bg-[#12141a]/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active
                  ? "text-violet-600 dark:text-violet-400"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2 : 1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon.map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
