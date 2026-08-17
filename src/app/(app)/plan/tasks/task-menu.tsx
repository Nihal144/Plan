"use client";

import { useEffect, useRef, useState } from "react";
import { toggleTask, deleteTask, deferTask } from "@/app/actions/tasks";

/**
 * The card's ⋮ menu.
 *
 * The actions used to be three icon buttons revealed on hover, which the timeline
 * cannot afford: the cards are narrower, and a hover-only control is invisible on
 * a phone. Folding them into one always-visible trigger costs a click and buys a
 * row that reads the same everywhere.
 *
 * Each item is a real form posting to the same Server Action as before, so the
 * menu works exactly once — no optimistic state to get out of step with the row.
 */
export function TaskMenu({
  taskId,
  taskText,
  done,
  day,
  repeatDaily,
}: {
  taskId: string;
  taskText: string;
  done: boolean;
  day: string;
  repeatDaily: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Same dismissal contract as the view switcher: outside click and Escape.
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
    <div ref={wrapRef} className="relative z-10 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Actions for “${taskText}”`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <form action={toggleTask}>
            <input type="hidden" name="id" value={taskId} />
            {/* Current state, not the target — the action inverts it. */}
            <input type="hidden" name="done" value={String(done)} />
            <MenuItem tone="emerald">
              {done ? <UndoIcon /> : <CheckIcon />}
              {done ? "Mark as not done" : "Mark as done"}
            </MenuItem>
          </form>

          {/* Meaningless for a repeat: it is one row that already lands on tomorrow,
              and pushing its start date would erase it from every earlier day. */}
          {!repeatDaily && !done && (
            <form action={deferTask}>
              <input type="hidden" name="id" value={taskId} />
              <input type="hidden" name="day" value={day} />
              <MenuItem tone="violet">
                <ArrowIcon />
                Finish tomorrow
              </MenuItem>
            </form>
          )}

          <form action={deleteTask}>
            <input type="hidden" name="id" value={taskId} />
            <MenuItem tone="red">
              <TrashIcon />
              {repeatDaily ? "Delete (every day)" : "Delete"}
            </MenuItem>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  tone,
  children,
}: {
  tone: "emerald" | "violet" | "red";
  children: React.ReactNode;
}) {
  const hover = {
    emerald: "hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300",
    violet: "hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-500/15 dark:hover:text-violet-300",
    red: "hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/15 dark:hover:text-red-300",
  }[tone];

  return (
    <button
      type="submit"
      role="menuitem"
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${hover}`}
    >
      {children}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}
