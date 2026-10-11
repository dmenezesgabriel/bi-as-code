import { describe, expect, it } from "vitest";
import type { ChartSeries } from "./types";
import { numericRange, seriesValueRange } from "./value-range";

const NORTH_SOUTH: readonly ChartSeries[] = [
  {
    name: "North",
    data: [
      ["W1", 2000],
      ["W2", 3000],
    ],
  },
  {
    name: "South",
    data: [
      ["W1", 3000],
      ["W2", null],
    ],
  },
];

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

describe("seriesValueRange", () => {
  it("spans every series' y when the series sit side by side", () => {
    const range = seriesValueRange(NORTH_SOUTH, false);

    expect(range).toEqual({ min: 2000, max: 3000 });
  });

  it("spans the per-x stack totals when stacked", () => {
    const range = seriesValueRange(NORTH_SOUTH, true);

    expect(range).toEqual({ min: 3000, max: 5000 });
  });

  it("stacks positives and negatives apart, as the chart draws them", () => {
    const mixed: readonly ChartSeries[] = [
      { name: "in", data: [["W1", 5000]] },
      { name: "out", data: [["W1", -4000]] },
      { name: "fees", data: [["W1", -2000]] },
    ];

    const range = seriesValueRange(mixed, true);

    expect(range).toEqual({ min: -6000, max: 5000 });
  });

  it("totals distinct Date instances of one instant together", () => {
    const dated: readonly ChartSeries[] = [
      { name: "a", data: [[new Date(2026, 0, 5), 10]] },
      { name: "b", data: [[new Date(2026, 0, 5), 15]] },
    ];

    const range = seriesValueRange(dated, "100%");

    expect(range).toEqual({ min: 25, max: 25 });
  });

  it("is undefined for an empty or all-null model", () => {
    expect(seriesValueRange([], true)).toBeUndefined();
    expect(seriesValueRange([{ data: [["W1", null]] }], false)).toBeUndefined();
  });
});
