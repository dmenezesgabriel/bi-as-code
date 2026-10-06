import { describe, expect, it } from "vitest";
import { ColumnError } from "../value/types";
import { TREND_ROWS } from "./series-chart.fixture";
import { toHeatmap } from "./to-heatmap";

const SPEC = { x: "week", y: "region", value: "orders" } as const;

describe("toHeatmap", () => {
  it("collects both domains in first-appearance order, raw values kept", () => {
    const model = toHeatmap(TREND_ROWS, SPEC);
    expect(model.xDomain).toEqual([1, 2, 3]);
    expect(model.yDomain).toEqual(["North", "South"]);
  });

  it("emits one [xIndex, yIndex, value] cell per observed row, sorted by y", () => {
    const model = toHeatmap(TREND_ROWS, SPEC);
    // y ascending: every North (yi 0) cell ahead of every South (yi 1) —
    // evidence's "sort by y coordinate to ensure proper rendering".
    expect(model.cells).toEqual([
      [0, 0, 120],
      [1, 0, 130],
      [2, 0, 140],
      [0, 1, 90],
      [1, 1, 95],
      [2, 1, 100],
    ]);
  });

  it("spans min/max over the observed values", () => {
    const model = toHeatmap(TREND_ROWS, SPEC);
    expect(model.min).toBe(90);
    expect(model.max).toBe(140);
  });

  it("returns an empty model for no rows", () => {
    expect(toHeatmap([], SPEC)).toEqual({
      xDomain: [],
      yDomain: [],
      cells: [],
      min: 0,
      max: 0,
    });
  });

  it("emits no cell for a row pair the fence never returned", () => {
    // Observed-only: South only has weeks 1–2 — no zero-filled week 3.
    const sparse = TREND_ROWS.filter(
      (r) => !(r.region === "South" && r.week === 3),
    );
    const model = toHeatmap(sparse, SPEC);
    expect(model.cells).toHaveLength(5);
    expect(
      model.cells.find(([xi, yi]) => xi === 2 && yi === 1),
    ).toBeUndefined();
  });

  it("drops rows whose x or y cell is null", () => {
    const model = toHeatmap(
      [
        { week: null, region: "North", orders: 5 },
        { week: 1, region: null, orders: 6 },
        { week: 1, region: "North", orders: 7 },
      ],
      SPEC,
    );
    expect(model.xDomain).toEqual([1]);
    expect(model.yDomain).toEqual(["North"]);
    expect(model.cells).toEqual([[0, 0, 7]]);
  });

  it("drops the value but keeps the axis position on a null cell", () => {
    const model = toHeatmap(
      [
        { week: 1, region: "North", orders: null },
        { week: 1, region: "South", orders: "n/a" },
        { week: 2, region: "North", orders: 4 },
      ],
      SPEC,
    );
    // Week 1 still owns its column — the blank cells read as "no data".
    expect(model.xDomain).toEqual([1, 2]);
    expect(model.cells).toEqual([[1, 0, 4]]);
    expect(model.min).toBe(4);
    expect(model.max).toBe(4);
  });

  it("renders an empty model when every value is non-numeric", () => {
    const model = toHeatmap(
      [
        { week: 1, region: "North", orders: "x" },
        { week: 2, region: "South", orders: null },
      ],
      SPEC,
    );
    expect(model.cells).toEqual([]);
    expect(model.min).toBe(0);
    expect(model.max).toBe(0);
  });

  it("passes duplicate (x,y) cells through in row order", () => {
    // The fence's `group by` owns dedup; echarts draws last-wins.
    const model = toHeatmap(
      [
        { week: 1, region: "North", orders: 10 },
        { week: 1, region: "North", orders: 20 },
      ],
      SPEC,
    );
    expect(model.cells).toEqual([
      [0, 0, 10],
      [0, 0, 20],
    ]);
  });

  it("keeps Date cells raw in the domain for fmt-side formatting", () => {
    const day = new Date("2026-01-05T00:00:00Z");
    const model = toHeatmap(
      [
        { day, region: "North", orders: 3 },
        { day, region: "South", orders: 4 },
      ],
      { x: "day", y: "region", value: "orders" },
    );
    expect(model.xDomain).toEqual([day]);
  });

  it.each(["x", "y", "value"] as const)(
    "throws ColumnError when %s names a column the result lacks",
    (prop) => {
      expect(() =>
        toHeatmap(TREND_ROWS, { ...SPEC, [prop]: "nope" }),
      ).toThrowError(ColumnError);
      expect(() =>
        toHeatmap(TREND_ROWS, { ...SPEC, [prop]: "nope" }),
      ).toThrowError(/"nope".*week.*region.*orders/);
    },
  );

  it("still reports a column miss when only some cells are usable", () => {
    expect(() =>
      toHeatmap([{ week: 1, region: "North", orders: null }], {
        ...SPEC,
        value: "nope",
      }),
    ).toThrowError(ColumnError);
  });
});
