import type { ReactNode } from "react";
import { glyphFor, type GlyphSource, type IconName, type Tone } from "./task-style";

/**
 * The coloured badge that sits on the timeline rail. The rules that choose which
 * icon and colour a task gets live in ./task-style — this file only draws them.
 */

/**
 * Solid fills with white glyphs, so the badge reads at 40px against either theme.
 * Each is nudged darker in light mode: a 500 on white is bright enough to vibrate,
 * while on the dark canvas it is the accent the whole row hangs off.
 */
const TONES: Record<Tone, string> = {
  indigo: "bg-indigo-600 dark:bg-indigo-500",
  amber: "bg-amber-500 dark:bg-amber-500",
  emerald: "bg-emerald-600 dark:bg-emerald-500",
  teal: "bg-teal-600 dark:bg-teal-500",
  slate: "bg-slate-500 dark:bg-slate-400",
  red: "bg-red-600 dark:bg-red-500",
  sky: "bg-sky-600 dark:bg-sky-500",
  cyan: "bg-cyan-600 dark:bg-cyan-500",
  violet: "bg-violet-600 dark:bg-violet-500",
  rose: "bg-rose-600 dark:bg-rose-500",
  orange: "bg-orange-600 dark:bg-orange-500",
  lime: "bg-lime-600 dark:bg-lime-500",
};

/**
 * lucide glyphs, inlined. The project has no icon dependency and every other icon
 * here is hand-drawn SVG; pulling in a package to render twenty paths would be a
 * bigger change than the feature.
 */
const ICONS = {
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  dot: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,
  moon: <path d="M20.98 13.2A8.5 8.5 0 1 1 10.8 3.02a7 7 0 0 0 10.18 10.18Z" />,
  sunrise: (
    <>
      <path d="M12 2v5m0-5L9.5 4.5M12 2l2.5 2.5" />
      <path d="M4.2 13.2 5.6 14.6M18.4 14.6l1.4-1.4M2 20h20M4 17h16" />
      <path d="M8 13a4 4 0 0 1 8 0" />
    </>
  ),
  walk: (
    <>
      <circle cx="13" cy="4" r="2" />
      <path d="m9 21 2-6 3-3 1-4 3 4 2 1" />
      <path d="m6 14 3-3 2-4" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
  snowflake: (
    <>
      <path d="M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17" />
      <path d="m9 4 3 2 3-2M9 20l3-2 3 2" />
    </>
  ),
  droplet: <path d="M12 3.5 6.8 9.8a7 7 0 1 0 10.4 0Z" />,
  utensils: (
    <>
      <path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10" />
      <path d="M17 3c-1.5 1.5-2 3.5-2 6s.7 3 2 3 2-.5 2-3-.5-4.5-2-6ZM17 12v9" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" />
      <path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2M5 3v2M9 3v2M13 3v2" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22Z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2.5" y="7" width="19" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M2.5 12.5h19" />
    </>
  ),
  message: (
    <>
      <path d="M21 11.5a8 8 0 0 1-11.6 7.2L3 21l2.3-6.4A8 8 0 1 1 21 11.5Z" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h2.5l2.6 12.4a1.5 1.5 0 0 0 1.5 1.1h9a1.5 1.5 0 0 0 1.5-1.1L21 7H5.5" />
    </>
  ),
  pill: (
    <>
      <rect x="1.8" y="8.3" width="20.4" height="7.4" rx="3.7" transform="rotate(-45 12 12)" />
      <path d="m8.6 8.6 6.8 6.8" />
    </>
  ),
  code: <path d="m8.5 7-5.5 5 5.5 5M15.5 7l5.5 5-5.5 5" />,
  sparkles: (
    <>
      <path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9Z" />
      <path d="m18 15 .9 2.1 2.1.9-2.1.9L18 21l-.9-2.1-2.1-.9 2.1-.9Z" />
    </>
  ),
  wallet: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19M6 15h3" />
    </>
  ),
  plane: (
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />
  ),
  heart: <path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.5a4.7 4.7 0 0 1 8.5 2.7c0 5.8-8.5 11.3-8.5 11.3Z" />,
} satisfies Record<IconName, ReactNode>;

/** The badge itself. `relative` keeps it painted over the rail line behind it. */
export function TaskGlyph({ task }: { task: GlyphSource }) {
  const { icon, tone } = glyphFor(task);

  return (
    <span
      /* The ring is the page background, not a colour: it punches a gap in the
         rail line behind the badge so the line appears to run under it. */
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ring-4 ring-white transition-colors dark:ring-[#12141a] ${TONES[tone]}`}
      aria-hidden="true"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[icon]}
      </svg>
    </span>
  );
}
