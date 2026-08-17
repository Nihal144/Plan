"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export const PLAN_VIEWS = [
  { href: "/plan/tasks", label: "Tasks" },
  { href: "/plan/fitness", label: "Fitness" },
] as const;

export type PlanView = (typeof PLAN_VIEWS)[number]["href"];

/**
 * The page title doubles as the view switcher, so the heading itself tells you
 * both where you are and that there is somewhere else to go.
 *
 * `date` is carried across the switch. Without it, changing view from a Thursday
 * silently drops you back on today — the two views describe the same day, so the
 * day has to survive the move.
 */
export function ViewSwitcher({ current, date }: { current: PlanView; date?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const currentLabel =
    PLAN_VIEWS.find((v) => v.href === current)?.label ?? "Tasks";

  // Close on outside click and on Escape — a menu you can only dismiss by
  // picking something is a trap.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-xl px-1 py-0.5 text-3xl font-bold tracking-tight transition-colors hover:text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500 lg:text-[2.4rem] dark:hover:text-zinc-300"
      >
        {currentLabel}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`mt-1 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {PLAN_VIEWS.map((view) => {
            const active = view.href === current;
            return (
              <Link
                key={view.href}
                href={date ? `${view.href}?date=${date}` : view.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-base font-medium transition-colors ${
                  active
                    ? "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {view.label}
                {active && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
