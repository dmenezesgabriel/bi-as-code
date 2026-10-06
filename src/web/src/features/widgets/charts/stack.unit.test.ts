import { describe, expect, it } from "vitest";
import { toPercentageStack } from "./stack";
import type { ChartSeries } from "./types";

const TWO_SERIES: readonly ChartSeries[] = [
  {
    name: "North",
    data: [
      [1, 40],
      [2, 30],
    ],
  },
  {
    name: "South",
    data: [
      [1, 60],
      [2, 70],
    ],
  },
];

describe("toPercentageStack", () => {
  it("normalizes each x to per-x fractions that sum to 1, keeping raw y", () => {
    const stacked = toPercentageStack(TWO_SERIES);
    expect(stacked[0]?.data).toEqual([
      [1, 0.4, 40],
      [2, 0.3, 30],
    ]);
    expect(stacked[1]?.data).toEqual([
      [1, 0.6, 60],
      [2, 0.7, 70],
    ]);
  });

  it("gives a lone series 1 at every x", () => {
    const stacked = toPercentageStack([{ name: "only", data: [[1, 42]] }]);
    expect(stacked[0]?.data).toEqual([[1, 1, 42]]);
  });

  it("emits 0 (not NaN) when an x totals zero or less, keeping the raw", () => {
    const stacked = toPercentageStack([
      {
        name: "a",
        data: [
          [1, 0],
          [2, -3],
        ],
      },
      {
        name: "b",
        data: [
          [1, 0],
          [2, 1],
        ],
      },
    ]);
    expect(stacked[0]?.data).toEqual([
      [1, 0, 0],
      [2, 0, -3],
    ]);
    expect(stacked[1]?.data).toEqual([
      [1, 0, 0],
      [2, 0, 1],
    ]);
  });

  it("keeps a null y as a null gap and ignores it in the totals", () => {
    const stacked = toPercentageStack([
      {
        name: "a",
        data: [
          [1, null],
          [2, null],
        ],
      },
      {
        name: "b",
        data: [
          [1, 5],
          [2, 10],
        ],
      },
    ]);
    expect(stacked[0]?.data).toEqual([
      [1, null, null],
      [2, null, null],
    ]);
    expect(stacked[1]?.data).toEqual([
      [1, 1, 5],
      [2, 1, 10],
    ]);
  });

  it("keys x by value, so equal Date instants across series still share totals", () => {
    const stacked = toPercentageStack([
      { name: "a", data: [[new Date("2026-01-05T00:00:00Z"), 1]] },
      { name: "b", data: [[new Date("2026-01-05T00:00:00Z"), 3]] },
    ]);
    expect(stacked[0]?.data[0]?.[1]).toBe(0.25);
    expect(stacked[1]?.data[0]?.[1]).toBe(0.75);
  });

  it("does not mutate the input series", () => {
    const input: ChartSeries[] = [
      { name: "a", data: [[1, 2]] },
      { name: "b", data: [[1, 2]] },
    ];
    toPercentageStack(input);
    expect(input[0]?.data[0]).toEqual([1, 2]);
    expect(input[1]?.data[0]).toEqual([1, 2]);
  });

  it("returns an empty list for no series", () => {
    expect(toPercentageStack([])).toEqual([]);
  });
});
