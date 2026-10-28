import { describe, expect, it } from "vitest";
import { binAxisTicks } from "./bin-axis-ticks";

describe("binAxisTicks", () => {
  it("ticks round values inside unround bin edges", () => {
    expect(binAxisTicks(2700, 6300)).toEqual([3000, 4000, 5000, 6000]);
  });

  it("keeps an edge that lands on the tick grid", () => {
    expect(binAxisTicks(0, 8000)).toEqual([0, 2000, 4000, 6000, 8000]);
  });

  it("ticks fractional spans without float noise", () => {
    expect(binAxisTicks(0.13, 0.91)).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(binAxisTicks(5, 5.5)).toEqual([5, 5.1, 5.2, 5.3, 5.4, 5.5]);
  });

  it("ticks a negative span", () => {
    expect(binAxisTicks(-35, 12)).toEqual([-30, -20, -10, 0, 10]);
  });

  it("ticks a single-value bin at its only edge pair", () => {
    // `toHistogram` collapses one distinct value to a [v, v + 1) bin.
    expect(binAxisTicks(7, 8)).toEqual([7, 7.2, 7.4, 7.6, 7.8, 8]);
  });

  it("returns no ticks for an empty or inverted extent", () => {
    expect(binAxisTicks(5, 5)).toEqual([]);
    expect(binAxisTicks(9, 3)).toEqual([]);
  });
});
