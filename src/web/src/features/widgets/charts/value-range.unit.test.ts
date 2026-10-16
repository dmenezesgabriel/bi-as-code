import { describe, expect, it } from "vitest";
import type { ChartSeries } from "./types";
import { axisValueRange, seriesValueRange } from "./value-range";

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

describe("seriesValueRange", () => {
  it("spans every series' y when the series sit side by side", () => {
    const range = seriesValueRange(NORTH_SOUTH, false);

    expect(range).toEqual({ min: 2000, max: 3000, whole: true });
  });

  it("spans the per-x stack totals when stacked", () => {
    const range = seriesValueRange(NORTH_SOUTH, true);

    expect(range).toEqual({ min: 3000, max: 5000, whole: true });
  });

  it("stacks positives and negatives apart, as the chart draws them", () => {
    const mixed: readonly ChartSeries[] = [
      { name: "in", data: [["W1", 5000]] },
      { name: "out", data: [["W1", -4000]] },
      { name: "fees", data: [["W1", -2000]] },
    ];

    const range = seriesValueRange(mixed, true);

    expect(range).toEqual({ min: -6000, max: 5000, whole: true });
  });

  it("totals distinct Date instances of one instant together", () => {
    const dated: readonly ChartSeries[] = [
      { name: "a", data: [[new Date(2026, 0, 5), 10]] },
      { name: "b", data: [[new Date(2026, 0, 5), 15]] },
    ];

    const range = seriesValueRange(dated, "100%");

    expect(range).toEqual({ min: 25, max: 25, whole: true });
  });

  it("judges a stack whole by its segments, not its totals", () => {
    const halves: readonly ChartSeries[] = [
      { name: "a", data: [["W1", 0.5]] },
      { name: "b", data: [["W1", 0.5]] },
    ];

    const range = seriesValueRange(halves, true);

    expect(range).toEqual({ min: 1, max: 1, whole: false });
  });

  it("is undefined for an empty or all-null model", () => {
    expect(seriesValueRange([], true)).toBeUndefined();
    expect(seriesValueRange([{ data: [["W1", null]] }], false)).toBeUndefined();
  });
});

describe("axisValueRange", () => {
  it("marks a range of whole numbers whole, nulls and strings aside", () => {
    const range = axisValueRange([0, null, 5, "n/a", 25]);

    expect(range).toEqual({ min: 0, max: 25, whole: true });
  });

  it("marks a range holding a fraction not whole", () => {
    const range = axisValueRange([1, 2.5, 4]);

    expect(range).toEqual({ min: 1, max: 4, whole: false });
  });

  it("reads bigint cells as whole numbers", () => {
    const range = axisValueRange([1, 3n, 7]);

    expect(range).toEqual({ min: 1, max: 7, whole: true });
  });

  it("is undefined when nothing is a finite number", () => {
    expect(axisValueRange([])).toBeUndefined();
    expect(axisValueRange(["a", null, Number.NaN])).toBeUndefined();
  });
});
