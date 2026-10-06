import { describe, expect, it } from "vitest";
import { ColumnError } from "../value/types";
import { SCATTER_ROWS } from "./series-chart.fixture";
import { toScatterSeries } from "./to-scatter-series";

describe("toScatterSeries", () => {
  it("projects a single y into one series of sparse [x, y] tuples", () => {
    const model = toScatterSeries(SCATTER_ROWS, {
      x: "orders",
      y: "revenue",
    });
    expect(model.xType).toBe("value");
    expect(model.xDomain).toEqual([120, 140, 90, 95]);
    expect(model.series).toEqual([
      {
        name: "revenue",
        y: "revenue",
        data: [
          [120, 4800],
          [140, 5300],
          [90, 3700],
          [95, 3900],
        ],
      },
    ]);
  });

  it("groups rows by the series column without domain-padding", () => {
    const model = toScatterSeries(SCATTER_ROWS, {
      x: "orders",
      y: "revenue",
      series: "region",
    });
    expect(model.series.map((s) => s.name)).toEqual(["North", "South"]);
    expect(model.series[0]?.data).toEqual([
      [120, 4800],
      [140, 5300],
    ]);
    expect(model.series[1]?.data).toEqual([
      [90, 3700],
      [95, 3900],
    ]);
  });

  it("emits one series per column when y is an array", () => {
    const model = toScatterSeries(SCATTER_ROWS, {
      x: "orders",
      y: ["revenue", "accounts"],
    });
    expect(model.series.map((s) => s.name)).toEqual(["revenue", "accounts"]);
    expect(model.series[0]?.data[0]).toEqual([120, 4800]);
    expect(model.series[1]?.data[0]).toEqual([120, 14]);
  });

  it("carries the size column in a third tuple slot", () => {
    const model = toScatterSeries(SCATTER_ROWS, {
      x: "orders",
      y: "revenue",
      size: "accounts",
    });
    expect(model.series[0]?.data).toEqual([
      [120, 4800, 14],
      [140, 5300, 18],
      [90, 3700, 9],
      [95, 3900, 11],
    ]);
  });

  it("names multi-y series by series value and column", () => {
    const model = toScatterSeries(SCATTER_ROWS, {
      x: "orders",
      y: ["revenue", "accounts"],
      series: "region",
    });
    expect(model.series.map((s) => s.name)).toEqual([
      "North - revenue",
      "South - revenue",
      "North - accounts",
      "South - accounts",
    ]);
  });

  it("drops rows whose x is null", () => {
    const rows = [
      { x: 1, y: 10 },
      { x: null, y: 99 },
      { x: 2, y: 20 },
    ];
    const model = toScatterSeries(rows, { x: "x", y: "y" });
    expect(model.xDomain).toEqual([1, 2]);
    expect(model.series[0]?.data).toEqual([
      [1, 10],
      [2, 20],
    ]);
  });

  it("emits null for non-numeric y and size cells", () => {
    const rows = [
      { x: 1, y: "abc", accounts: "x" },
      { x: 2, y: 20, accounts: 5 },
    ];
    const model = toScatterSeries(rows, { x: "x", y: "y", size: "accounts" });
    expect(model.series[0]?.data[0]).toEqual([1, null, null]);
    expect(model.series[0]?.data[1]).toEqual([2, 20, 5]);
  });

  it.each([
    [{ x: "nope" }, "nope"],
    [{ y: "nope" }, "nope"],
    [{ series: "nope" }, "nope"],
    [{ size: "nope" }, "nope"],
  ])("throws ColumnError for %o naming %s", (patch, column) => {
    const spec = { x: "orders", y: "revenue", ...patch };
    expect(() => toScatterSeries(SCATTER_ROWS, spec)).toThrowError(ColumnError);
    expect(() => toScatterSeries(SCATTER_ROWS, spec)).toThrowError(
      expect.objectContaining({ message: expect.stringContaining(column) }),
    );
  });

  it.each([
    [{ x: 1, y: 2 }, "value"],
    [{ x: 1n, y: 2 }, "value"],
    [{ x: new Date("2026-01-01"), y: 2 }, "time"],
    [{ x: "North", y: 2 }, "category"],
  ])("infers xType %s → %s", (row, xType) => {
    expect(toScatterSeries([row], { x: "x", y: "y" }).xType).toBe(xType);
  });

  it("returns an empty model for no rows", () => {
    const model = toScatterSeries([], { x: "x", y: "y" });
    expect(model).toEqual({ xDomain: [], xType: "category", series: [] });
  });
});
