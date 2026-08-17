"use client";

import { useActionState, useRef } from "react";
import { addEntry, type GymFormState } from "@/app/actions/gym";

const EMPTY: GymFormState = {};

/**
 * Manual entry. Stays open and refocuses itself after each add, because logging
 * several exercises in a row is the normal case.
 *
 * `datalist` gives autocomplete against the category's pool while leaving the
 * field free text — a custom exercise name is always allowed.
 */
export function AddEntry({
  categoryId,
  date,
  suggestions,
}: {
  categoryId: string;
  date: string;
  suggestions: string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, action, pending] = useActionState(
    async (prev: GymFormState, formData: FormData) => {
      const result = await addEntry(prev, formData);
      if (result.ok) {
        formRef.current?.reset();
        inputRef.current?.focus();
      }
      return result;
    },
    EMPTY,
  );

  const listId = `pool-${categoryId}`;

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="date" value={date} />

      <div className="flex gap-2">
        <input
          ref={inputRef}
          name="exercise_name"
          list={listId}
          placeholder="Add an exercise…"
          aria-label="Exercise name"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-[3px] focus:ring-orange-500/15 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <datalist id={listId}>
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
