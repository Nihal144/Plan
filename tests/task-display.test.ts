import { describe, it, expect } from "vitest";
import { formatDuration, formatClock } from "@/lib/dates";
import { glyphFor, type GlyphSource } from "@/app/(app)/plan/tasks/task-style";

/**
 * The timeline's two derived values.
 *
 * Both are pure and both are guesses that a person will read as a fact — a badge
 * that says "cold shower" is a snowflake, a subtitle that says 80 minutes is
 * "1 hr 20 mins" — so the edges are pinned here rather than eyeballed in the app.
 */

function task(partial: Partial<GlyphSource> = {}): GlyphSource {
  return { text: "Something", category: null, kind: "general", done: false, ...partial };
}

describe("formatDuration", () => {
  it("renders minutes under an hour on their own", () => {
    expect(formatDuration(30)).toBe("30 mins");
    expect(formatDuration(5)).toBe("5 mins");
  });

  it("renders hours and minutes together", () => {
    expect(formatDuration(80)).toBe("1 hr 20 mins");
    expect(formatDuration(155)).toBe("2 hrs 35 mins");
  });

  // "1 hr 0 mins" is how a naive implementation reads, and it is not how anyone says it.
  it("drops the empty half of a whole number of hours", () => {
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(120)).toBe("2 hrs");
  });

  it("singularises both units", () => {
    expect(formatDuration(1)).toBe("1 min");
    expect(formatDuration(61)).toBe("1 hr 1 min");
  });

  // An unset duration renders nothing at all rather than "0 mins".
  it("returns null for no duration", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
  });
});

describe("formatClock", () => {
  it("keeps the gutter one fixed width", () => {
    expect(formatClock("22:10:00")).toBe("22:10");
    // Postgres returns "05:05:00", but a bare "5:05" would ragged the column.
    expect(formatClock("05:05:00")).toBe("05:05");
  });

  it("returns null for an untimed task", () => {
    expect(formatClock(null)).toBeNull();
  });
});

describe("glyphFor", () => {
  it("matches an activity from the task text", () => {
    expect(glyphFor(task({ text: "Sleep" }))).toEqual({ icon: "moon", tone: "indigo" });
    expect(glyphFor(task({ text: "Woke Up" }))).toEqual({ icon: "sunrise", tone: "amber" });
    expect(glyphFor(task({ text: "Walk 7.5K" }))).toEqual({ icon: "walk", tone: "teal" });
    expect(glyphFor(task({ text: "Infrared sauna" }))).toEqual({ icon: "sun", tone: "red" });
  });

  // The ordering the rule list depends on: "cold shower" contains "shower", and the
  // specific rule has to win or every plunge renders as a wash.
  it("prefers the more specific rule", () => {
    expect(glyphFor(task({ text: "Cold shower" })).icon).toBe("snowflake");
    expect(glyphFor(task({ text: "Shower" })).icon).toBe("droplet");
  });

  // Word boundaries, not substrings: "medical" must not make "med" match, and
  // "backup" must not read as a back workout.
  it("matches whole words only", () => {
    expect(glyphFor(task({ text: "Ice bath" })).icon).toBe("snowflake");
    expect(glyphFor(task({ text: "Nice weather" })).icon).not.toBe("snowflake");
  });

  it("falls back to the tag when the text says nothing", () => {
    // "Benji" matches no rule; the tag is what makes this a walk.
    expect(glyphFor(task({ text: "Benji", category: "Walk" })).icon).toBe("walk");
  });

  // The title names the activity, the tag names the bucket — and the badge is
  // meant to show the activity.
  it("prefers the text when both match", () => {
    expect(glyphFor(task({ text: "Pay the council tax", category: "Admin" })).icon).toBe(
      "wallet",
    );
  });

  // "book" is a verb here. A travel word alongside it settles which sense was meant.
  it("reads 'book the flights' as travel, not reading", () => {
    expect(glyphFor(task({ text: "Book the flights" })).icon).toBe("plane");
    expect(glyphFor(task({ text: "Book club" })).icon).toBe("book");
  });

  it("treats a fitness task as fitness whatever it is called", () => {
    expect(glyphFor(task({ text: "Benji", kind: "fitness" }))).toEqual({
      icon: "dumbbell",
      tone: "orange",
    });
  });

  // Done reads as done first: one tick in one colour down the whole rail.
  it("overrides everything once done", () => {
    expect(glyphFor(task({ text: "Sleep", done: true }))).toEqual({
      icon: "check",
      tone: "emerald",
    });
    expect(glyphFor(task({ text: "Anything", kind: "fitness", done: true })).icon).toBe("check");
  });

  describe("the unmatched fallback", () => {
    it("is stable for the same words", () => {
      const first = glyphFor(task({ text: "Sort out the loft" }));
      const second = glyphFor(task({ text: "Sort out the loft" }));
      expect(first).toEqual(second);
      expect(first.icon).toBe("dot");
    });

    it("gives different tasks different colours", () => {
      const tones = new Set(
        ["Alpha", "Beta thing", "Gamma ray", "Delta plan", "Epsilon"].map(
          (text) => glyphFor(task({ text })).tone,
        ),
      );
      // Not a guarantee of uniqueness — just that it is not one colour for everything.
      expect(tones.size).toBeGreaterThan(1);
    });
  });
});
