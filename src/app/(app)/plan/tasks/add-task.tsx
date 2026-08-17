"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addTask, type TaskFormState } from "@/app/actions/tasks";
import { longDayLabel } from "@/lib/dates";

const EMPTY: TaskFormState = {};

export function AddTask({ day }: { day: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Collapsing happens inside the action rather than in an effect watching the
  // result — setState in an effect body triggers a second, cascading render.
  const [state, action, pending] = useActionState(
    async (prev: TaskFormState, formData: FormData) => {
      const result = await addTask(prev, formData);
      if (result.ok) {
        formRef.current?.reset();
        setOpen(false);
      }
      return result;
    },
    EMPTY,
  );

  useEffect(() => {
    if (open) firstFieldRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-300 bg-violet-50/60 px-5 py-4 font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add New Task
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-white p-4 dark:border-violet-500/30 dark:bg-zinc-900"
    >
      {/* The day comes from the page, so a task always lands on the day you're viewing. */}
      <input type="hidden" name="scheduled_on" value={day} />

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          New task · {longDayLabel(day)}
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>

      <input
        ref={firstFieldRef}
        name="text"
        placeholder="What needs doing?"
        aria-label="Task name"
        autoComplete="off"
        className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-[15px] focus:border-violet-400 focus:outline-none focus:ring-[3px] focus:ring-violet-500/15 dark:border-zinc-700 dark:bg-zinc-800"
      />

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Time</span>
          <input
            type="time"
            name="scheduled_time"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tag</span>
          <input
            name="category"
            placeholder="Optional"
            autoComplete="off"
            maxLength={24}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>
      </div>

      {/* A checkbox, not a Yes/No pair: the default is a one-off, and repeating
          is the deliberate opt-in. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 has-checked:border-violet-400 has-checked:bg-violet-50 dark:border-zinc-700 dark:has-checked:bg-violet-500/15">
        <input
          type="checkbox"
          name="repeat_daily"
          className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium">Repeat every day</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            Appears on every day from this one onward. Ticking it off one day
            leaves it waiting the next.
          </span>
        </span>
      </label>

      {/* Orange rather than violet, matching how the task will render in the list. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 has-checked:border-orange-400 has-checked:bg-orange-50 dark:border-zinc-700 dark:has-checked:bg-orange-500/15">
        <input
          type="checkbox"
          name="kind"
          value="fitness"
          className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium">Fitness</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            Shows orange here and opens in the Fitness view, where it gets its own
            list of exercises.
          </span>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add task"}
      </button>
    </form>
  );
}
