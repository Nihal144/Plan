import type { Task } from "@/lib/dal";

/**
 * Which icon and colour a task gets on the timeline.
 *
 * Derived from what the task says rather than stored on the row. That is a
 * deliberate trade: no icon picker to fill in, no migration every time someone
 * invents a category, and "Cold shower" looks like a cold shower the moment you
 * type it. It follows the rule the tag colours already use — the same words always
 * produce the same badge.
 *
 * The cost is that the match is a guess, so it degrades on purpose: an unmatched
 * task gets a neutral dot in a colour hashed from its own text, which is stable and
 * distinguishable rather than a wall of identical grey dots.
 *
 * Kept apart from the component that draws it so the rules can be tested as data,
 * without rendering anything.
 */

export type IconName =
  | "check"
  | "dot"
  | "moon"
  | "sunrise"
  | "walk"
  | "dumbbell"
  | "sun"
  | "snowflake"
  | "droplet"
  | "utensils"
  | "coffee"
  | "book"
  | "briefcase"
  | "message"
  | "cart"
  | "pill"
  | "code"
  | "sparkles"
  | "wallet"
  | "plane"
  | "heart";

export type Tone =
  | "indigo"
  | "amber"
  | "emerald"
  | "teal"
  | "slate"
  | "red"
  | "sky"
  | "cyan"
  | "violet"
  | "rose"
  | "orange"
  | "lime";

/**
 * First match wins, so the specific sits above the general — "cold shower" has to
 * be tested before "shower", or every plunge renders as a wash.
 */
const RULES: { match: RegExp; icon: IconName; tone: Tone }[] = [
  { match: /\b(sleep|sleeping|bed|bedtime|nap|night)\b/, icon: "moon", tone: "indigo" },
  { match: /\b(wake|woke|awake|alarm|rise|sunrise|get up)\b/, icon: "sunrise", tone: "amber" },
  { match: /\b(cold shower|ice bath|cold plunge|plunge|cryo|ice|freezing)\b/, icon: "snowflake", tone: "cyan" },
  { match: /\b(sauna|steam room|heat|hot tub|infrared)\b/, icon: "sun", tone: "red" },
  { match: /\b(shower|bath|wash|brush|shave|skincare)\b/, icon: "droplet", tone: "sky" },
  { match: /\b(walk|walking|steps|stroll|hike|run|running|jog|jogging|ruck|cycle|swim)\b/, icon: "walk", tone: "teal" },
  { match: /\b(gym|workout|lift|lifting|weights|squat|press|training|exercise|reps|sets|push|pull|legs|back|chest|core|abs)\b/, icon: "dumbbell", tone: "slate" },
  { match: /\b(meditat\w*|breathwork|breathe|yoga|stretch|mobility|journal|gratitude)\b/, icon: "heart", tone: "rose" },
  { match: /\b(coffee|tea|espresso|matcha|brew)\b/, icon: "coffee", tone: "amber" },
  { match: /\b(eat|meal|food|cook|cooking|breakfast|lunch|dinner|snack|protein|shake|recipe)\b/, icon: "utensils", tone: "orange" },
  { match: /\b(water|hydrate|drink)\b/, icon: "droplet", tone: "sky" },
  // Above the reading rule on purpose: "book" is ambiguous between the noun and
  // the verb, and "book the flights" is not reading. A travel word next to it
  // settles which one was meant; "book club" still falls through to reading.
  { match: /\b(flight|flights|fly|airport|travel|train|drive|trip|pack|packing|hotel)\b/, icon: "plane", tone: "sky" },
  { match: /\b(read|reading|book|study|studying|learn|course|revise|notes)\b/, icon: "book", tone: "violet" },
  { match: /\b(work|meeting|standup|stand-up|interview|email|inbox|office|deck|report|admin)\b/, icon: "briefcase", tone: "slate" },
  { match: /\b(call|called|checked in|check in|catch up|text|message|reply|ping|ring)\b/, icon: "message", tone: "emerald" },
  { match: /\b(shop|shopping|grocer\w*|buy|order|errand|pick up|collect)\b/, icon: "cart", tone: "lime" },
  { match: /\b(med|meds|medicat\w*|vitamin\w*|supplement\w*|pill\w*|doctor|dentist|therapy|appointment)\b/, icon: "pill", tone: "rose" },
  { match: /\b(code|coding|build|ship|deploy|bug|refactor|review|debug|test)\b/, icon: "code", tone: "sky" },
  { match: /\b(clean|cleaning|tidy|laundry|dishes|hoover|vacuum|bins|chores)\b/, icon: "sparkles", tone: "teal" },
  { match: /\b(pay|bill|bills|bank|invoice|budget|rent|tax|money|transfer)\b/, icon: "wallet", tone: "emerald" },
];

const FALLBACK_TONES: Tone[] = [
  "violet",
  "sky",
  "emerald",
  "amber",
  "rose",
  "teal",
  "orange",
  "indigo",
];

/** Same hash the tag swatches use, so one task's badge never moves between renders. */
function hashTone(seed: string): Tone {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_TONES[hash % FALLBACK_TONES.length];
}

export type GlyphSource = Pick<Task, "text" | "category" | "kind" | "done">;

export function glyphFor(task: GlyphSource): { icon: IconName; tone: Tone } {
  // Finished work reads as finished first and as its category second — one tick in
  // one colour, so a completed day is scannable down the rail. The card still says
  // "Done" in words; the colour is never the only signal.
  if (task.done) return { icon: "check", tone: "emerald" };

  // The app's own idea of a fitness task beats any guess from the words in it.
  if (task.kind === "fitness") return { icon: "dumbbell", tone: "orange" };

  // Title first, tag second. The title names the activity ("Pay the council tax")
  // while the tag names the bucket it lives in ("Admin"), and the icon is meant to
  // show the activity. The order only decides the case where both match — where
  // only the tag does, it still wins by falling through.
  const category = task.category?.toLowerCase() ?? "";
  const text = task.text.toLowerCase();

  for (const source of [text, category]) {
    if (!source) continue;
    for (const rule of RULES) {
      if (rule.match.test(source)) return { icon: rule.icon, tone: rule.tone };
    }
  }

  // A neutral dot rather than a tick: a tick is what "done" looks like, and the
  // difference between the two must not come down to the colour alone.
  return { icon: "dot", tone: hashTone(category || text) };
}
