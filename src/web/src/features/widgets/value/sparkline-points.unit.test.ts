import { describe, expect, it } from "vitest";
import {
  projectSparklinePoints,
  sparklineBaseline,
  sparklineDomain,
} from "./sparkline-points";
import { ColumnError } from "./types";

const ROWS = [
  { week: 1, revenue: 10 },
  { week: 2, revenue: 12 },
  { week: 3, revenue: 9 },
];

describe("projectSparklinePoints", () => {
  it("defaults x/y to the row's first two columns", () => {
    const points = projectSparklinePoints(ROWS);
    expect(points.map((p) => p.x)).toEqual([1, 2, 3]);
    expect(points.map((p) => p.y)).toEqual([10, 12, 9]);
  });

  it("honors named x and y columns", () => {
    const points = projectSparklinePoints(ROWS, "revenue", "week");
    expect(points.map((p) => p.x)).toEqual([10, 12, 9]);
    expect(points.map((p) => p.y)).toEqual([1, 2, 3]);
  });

  it("uses position as x when the row has one column", () => {
    const points = projectSparklinePoints([{ n: 4 }, { n: 7 }]);
    expect(points.map((p) => p.y)).toEqual([4, 7]);
    expect(points.map((p) => p.x)).toEqual([0, 1]);
  });

  it("throws a ColumnError naming the column and the available ones", () => {
    expect(() => projectSparklinePoints(ROWS, "week", "sales")).toThrowError(
      ColumnError,
    );
    try {
      projectSparklinePoints(ROWS, "week", "sales");
    } catch (error) {
      expect(error).toBeInstanceOf(ColumnError);
      expect((error as ColumnError).message).toBe(
        'column "sales" is not in the result — available: week, revenue',
      );
    }
  });

  it("skips rows whose y is not a finite number, coercing numeric strings", () => {
    const points = projectSparklinePoints([
      { w: 1, v: "3.5" },
      { w: 2, v: null },
      { w: 3, v: "abc" },
      { w: 4, v: NaN },
      { w: 5, v: Infinity },
      { w: 6, v: 8 },
    ]);
    expect(points.map((p) => p.y)).toEqual([3.5, 8]);
  });

  it("returns no points for empty rows without touching columns", () => {
    expect(projectSparklinePoints([], "missing", "also-missing")).toEqual([]);
  });
});

describe("sparklineDomain", () => {
  it("anchors to the data range, not zero", () => {
    const [min, max] = sparklineDomain([100, 110, 105]);
    expect(min).toBeCloseTo(99.9, 5);
    expect(max).toBeCloseTo(110.1, 5);
    expect(min).toBeGreaterThan(0);
  });

  it("pads a flat series symmetrically so its line sits mid-height", () => {
    const [min, max] = sparklineDomain([7, 7, 7]);
    expect(7 - min).toBeCloseTo(max - 7, 10);
    expect(min).toBeLessThan(7);
  });

  it("pads a zero-valued flat series to a nonzero span", () => {
    const [min, max] = sparklineDomain([0]);
    expect(min).toBeLessThan(0);
    expect(max).toBeGreaterThan(0);
  });
});

describe("sparklineBaseline", () => {
  it("is zero only when the series crosses zero", () => {
    expect(sparklineBaseline([-5, 10])).toBe(0);
    expect(sparklineBaseline([5, 10])).toBe(5);
    expect(sparklineBaseline([-10, -5])).toBe(-10);
    expect(sparklineBaseline([-2, -1, 0])).toBe(-2);
  });
});
