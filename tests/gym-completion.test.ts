import { describe, it, expect } from "vitest";
import { isDayComplete } from "@/lib/gym/completion";

describe("isDayComplete", () => {
  it("is true when every entry is done", () => {
    expect(isDayComplete([{ is_done: true }, { is_done: true }])).toBe(true);
  });

  it("is false while anything is outstanding", () => {
    expect(isDayComplete([{ is_done: true }, { is_done: false }])).toBe(false);
  });

  // The whole reason this function exists: [].every() is true, so a day with no
  // exercises would otherwise tick the Fitness task the moment it was opened.
  it("is false for a day with no entries", () => {
    expect(isDayComplete([])).toBe(false);
  });

  it("is true for a single finished entry", () => {
    expect(isDayComplete([{ is_done: true }])).toBe(true);
  });

  it("is false for a single unfinished entry", () => {
    expect(isDayComplete([{ is_done: false }])).toBe(false);
  });
});
