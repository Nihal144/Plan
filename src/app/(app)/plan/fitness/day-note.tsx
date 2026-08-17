"use client";

import { useActionState, useState } from "react";
import { saveDayNote, type GymFormState } from "@/app/actions/gym";

const EMPTY: GymFormState = {};

/**
 * The single day-level note for one category and date.
 *
 * Explicit Save rather than debounced autosave: a note is prose, and a save that
 * fires mid-sentence either spams the server or silently loses the tail of what
 * was typed. The button only appears once the text differs from what is stored,
 * so it is not a permanent piece of furniture.
 *
 * The caller keys this on (category, date) so switching tab or day remounts it
 * with fresh state. Syncing `note` into state with an effect instead would
 * cascade a second render on every keystroke-free load.
 */
export function DayNote({
  categoryId,
  date,
  note,
}: {
  categoryId: string;
  date: string;
  note: string;
}) {
  const [value, setValue] = useState(note);
  const [state, action, pending] = useActionState(saveDayNote, EMPTY);

  const dirty = value.trim() !== note.trim();

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="date" value={date} />

      <label htmlFor="day-note" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Note
      </label>
      <textarea
        id="day-note"
        name="day_note"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="How did it go? Anything to remember for next time…"
        className="w-full resize-y rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-[3px] focus:ring-orange-500/15 dark:border-zinc-700 dark:bg-zinc-800"
      />

      <div className="flex items-center gap-3">
        {dirty && (
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save note"}
          </button>
        )}
        {!dirty && state.ok && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>
        )}
        {state.error && (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
