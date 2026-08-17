"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "@/lib/nav";

/** Desktop rail: icon-only, with the label as tooltip and accessible name. */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col items-center gap-2">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            title={item.label}
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
              active
                ? "bg-white/15 text-white"
                : "text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
            }`}
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
              {item.icon.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
          </Link>
        );
      })}
    </nav>
  );
}
