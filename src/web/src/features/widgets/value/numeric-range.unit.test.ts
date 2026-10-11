import { describe, expect, it } from "vitest";
import { numericRange } from "./numeric-range";

describe("numericRange", () => {
  it("spans the smallest and largest number", () => {
    const range = numericRange([4800, 3700, 6100]);

    expect(range).toEqual({ min: 3700, max: 6100 });
  });

  it("skips nulls, strings, dates and non-finite numbers", () => {
    const range = numericRange([null, "North", new Date(0), NaN, Infinity, 7]);

    expect(range).toEqual({ min: 7, max: 7 });
  });

  it("is undefined when no value is a number", () => {
    expect(numericRange([])).toBeUndefined();
    expect(numericRange(["North", null])).toBeUndefined();
  });
});
