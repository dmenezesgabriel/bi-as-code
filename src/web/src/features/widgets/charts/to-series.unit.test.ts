import { describe, expect, it } from "vitest";
import { ColumnError } from "../value/types";
import { inferXType, seriesValuesOf, toSeries } from "./to-series";

const REVENUE = [
  { week: 1, revenue: 10 },
  { week: 2, revenue: 12 },
  { week: 3, revenue: 9 },
];

// weeks × regions — week 3 has no North row, week 2 has no South row:
// the union-alignment fixture.
const TREND = [
  { week: 1, region: "North", orders: 40 },
  { week: 1, region: "South", orders: 25 },
  { week: 2, region: "North", orders: 44 },
  { week: 2, region: "West", orders: 30 },
  { week: 3, region: "South", orders: 27 },
  { week: 3, region: "West", orders: 33 },
];

describe("toSeries", () => {
  it("projects a single y into one series named after the column", () => {
    const model = toSeries(REVENUE, { x: "week", y: "revenue" }, "bar");
    expect(model.xDomain).toEqual(["1", "2", "3"]);
    expect(model.xType).toBe("category");
    expect(model.series).toEqual([
      {
        name: "revenue",
        data: [
          ["1", 10],
          ["2", 12],
          ["3", 9],
        ],
      },
    ]);
  });

  it("groups rows by the series column, union-aligning every series to the domain", () => {
    const model = toSeries(
      TREND,
      { x: "week", y: "orders", series: "region" },
      "line",
    );
    expect(model.xDomain).toEqual([1, 2, 3]);
    expect(model.series.map((s) => s.name)).toEqual(["North", "South", "West"]);
    expect(model.series[0]?.data).toEqual([
      [1, 40],
      [2, 44],
      [3, null],
    ]);
    expect(model.series[1]?.data).toEqual([
      [1, 25],
      [2, null],
      [3, 27],
    ]);
  });

  it("emits one series per column when y is an array", () => {
    const rows = [
      { week: 1, a: 1, b: 2 },
      { week: 2, a: 3, b: 4 },
    ];
    const model = toSeries(rows, { x: "week", y: ["a", "b"] }, "line");
    expect(model.series.map((s) => s.name)).toEqual(["a", "b"]);
    expect(model.series[0]?.data).toEqual([
      [1, 1],
      [2, 3],
    ]);
    expect(model.series[1]?.data).toEqual([
      [1, 2],
      [2, 4],
    ]);
  });

  it("crosses multi-y with the series column, named '<series> - <y>' y-major", () => {
    const rows = [
      { w: 1, region: "North", a: 1, b: 10 },
      { w: 1, region: "South", a: 2, b: 20 },
      { w: 2, region: "North", a: 3, b: 30 },
      { w: 2, region: "South", a: 4, b: 40 },
    ];
    const model = toSeries(
      rows,
      { x: "w", y: ["a", "b"], series: "region" },
      "bar",
    );
    expect(model.series.map((s) => s.name)).toEqual([
      "North - a",
      "South - a",
      "North - b",
      "South - b",
    ]);
    expect(model.series[0]?.data).toEqual([
      ["1", 1],
      ["2", 3],
    ]);
  });

  it("maps each legend name back to the raw series cell", () => {
    const model = toSeries(
      TREND,
      { x: "week", y: "orders", series: "region" },
      "line",
    );
    expect(model.seriesValues).toEqual(
      new Map([
        ["North", "North"],
        ["South", "South"],
        ["West", "West"],
      ]),
    );
  });

  it("keeps the raw cell when the legend name is a stringified key", () => {
    const cohort = new Date("2026-01-05T00:00:00Z");
    const model = toSeries(
      [{ w: 1, cohort, v: 10 }],
      { x: "w", y: "v", series: "cohort" },
      "bar",
    );
    expect(model.series[0]?.name).toBe(String(cohort));
    expect(model.seriesValues?.get(String(cohort))).toBe(cohort);
  });

  it("maps the composed '<key> - <y>' names under multi-y + series", () => {
    const model = toSeries(
      [
        { w: 1, region: "North", a: 1, b: 10 },
        { w: 1, region: "South", a: 2, b: 20 },
      ],
      { x: "w", y: ["a", "b"], series: "region" },
      "bar",
    );
    expect([...(model.seriesValues?.keys() ?? [])]).toEqual([
      "North - a",
      "South - a",
      "North - b",
      "South - b",
    ]);
  });

  it("carries no seriesValues with the series column unbound", () => {
    const model = toSeries(TREND, { x: "week", y: "orders" }, "line");
    expect(model.seriesValues).toBeUndefined();
  });

  it("keeps the x domain in first-appearance order, not sorted", () => {
    const rows = [
      { w: "c", v: 1 },
      { w: "a", v: 2 },
      { w: "b", v: 3 },
    ];
    expect(toSeries(rows, { x: "w", y: "v" }, "bar").xDomain).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("drops rows whose x cell is missing", () => {
    const rows = [
      { w: "a", v: 1 },
      { w: null, v: 2 },
      { v: 3 },
      { w: "b", v: 4 },
    ];
    const model = toSeries(rows, { x: "w", y: "v" }, "bar");
    expect(model.xDomain).toEqual(["a", "b"]);
    expect(model.series[0]?.data).toEqual([
      ["a", 1],
      ["b", 4],
    ]);
  });

  it("keeps the x position but emits a null gap for non-numeric y", () => {
    const rows = [
      { w: "a", v: 1 },
      { w: "b", v: null },
      { w: "c", v: "nope" },
      { w: "d", v: NaN },
      { w: "e", v: 5 },
    ];
    const model = toSeries(rows, { x: "w", y: "v" }, "line");
    expect(model.xDomain).toEqual(["a", "b", "c", "d", "e"]);
    expect(model.series[0]?.data).toEqual([
      ["a", 1],
      ["b", null],
      ["c", null],
      ["d", null],
      ["e", 5],
    ]);
  });

  it("coerces bigint y cells — DuckDB count(*) lands as bigint through the fake", () => {
    const rows = [
      { w: "a", n: 5n },
      { w: "b", n: 7n },
    ];
    expect(toSeries(rows, { x: "w", y: "n" }, "bar").series[0]?.data).toEqual([
      ["a", 5],
      ["b", 7],
    ]);
  });

  it("coerces numeric-string y cells", () => {
    const rows = [{ w: "a", v: "3.5" }];
    expect(toSeries(rows, { x: "w", y: "v" }, "line").series[0]?.data).toEqual([
      ["a", 3.5],
    ]);
  });

  it("lets a later duplicate (x, series) row win", () => {
    const rows = [
      { w: "a", r: "x", v: 1 },
      { w: "a", r: "x", v: 9 },
    ];
    expect(
      toSeries(rows, { x: "w", y: "v", series: "r" }, "bar").series[0]?.data,
    ).toEqual([["a", 9]]);
  });

  it("buckets null series cells under 'Unknown'", () => {
    const rows = [
      { w: "a", r: "North", v: 1 },
      { w: "a", r: null, v: 2 },
    ];
    expect(
      toSeries(rows, { x: "w", y: "v", series: "r" }, "bar").series.map(
        (s) => s.name,
      ),
    ).toEqual(["North", "Unknown"]);
  });

  it("throws ColumnError naming the column and the available keys", () => {
    expect(() =>
      toSeries(REVENUE, { x: "day", y: "revenue" }, "bar"),
    ).toThrowError(ColumnError);
    try {
      toSeries(REVENUE, { x: "day", y: "revenue" }, "bar");
    } catch (error) {
      expect((error as ColumnError).message).toBe(
        'column "day" is not in the result — available: week, revenue',
      );
    }
  });

  it("checks every y entry and the series column the same way", () => {
    expect(() =>
      toSeries(REVENUE, { x: "week", y: ["revenue", "orders"] }, "bar"),
    ).toThrowError(expect.objectContaining({ column: "orders" }) as Error);
    expect(() =>
      toSeries(REVENUE, { x: "week", y: "revenue", series: "region" }, "bar"),
    ).toThrowError(ColumnError);
  });

  it("returns an empty model for empty rows without touching columns", () => {
    expect(toSeries([], { x: "missing", y: "also-missing" }, "bar")).toEqual({
      xDomain: [],
      xType: "category",
      series: [],
    });
  });
});

describe("seriesValuesOf", () => {
  it("spreads nothing with the series column unbound", () => {
    expect(seriesValuesOf(TREND, undefined, ["orders"])).toEqual({});
  });

  it("maps every y's legend name to the first raw cell of its key", () => {
    const rows = [
      { region: "North", a: 1, b: 10 },
      { region: null, a: 2, b: 20 },
      { region: "North", a: 3, b: 30 },
    ];
    const { seriesValues } = seriesValuesOf(rows, "region", ["a", "b"]);
    expect(seriesValues).toEqual(
      new Map([
        ["North - a", "North"],
        ["Unknown - a", null],
        ["North - b", "North"],
        ["Unknown - b", null],
      ]),
    );
  });
});

describe("inferXType", () => {
  it("infers a category axis for string cells on every chart type", () => {
    for (const type of ["bar", "line", "area"] as const) {
      expect(inferXType(["North", "South"], type)).toBe("category");
    }
  });

  it("infers category for numeric x on bars, value on line and area", () => {
    expect(inferXType([1, 2, 3], "bar")).toBe("category");
    expect(inferXType([1, 2, 3], "line")).toBe("value");
    expect(inferXType([1, 2, 3], "area")).toBe("value");
  });

  it("infers a time axis for Date cells", () => {
    const dates = [new Date("2026-01-05"), new Date("2026-01-12")];
    for (const type of ["bar", "line", "area"] as const) {
      expect(inferXType(dates, type)).toBe("time");
    }
  });

  it("reads the first non-null cell and falls back to category", () => {
    expect(inferXType([null, "a"], "bar")).toBe("category");
    expect(inferXType([undefined, 5], "line")).toBe("value");
    expect(inferXType([null, undefined], "line")).toBe("category");
  });

  it("treats bigint x like number x", () => {
    expect(inferXType([1n, 2n], "bar")).toBe("category");
    expect(inferXType([1n, 2n], "line")).toBe("value");
  });
});

describe("toSeries x normalization", () => {
  it("stringifies numeric x on a category axis so echarts can't read an index", () => {
    const model = toSeries(REVENUE, { x: "week", y: "revenue" }, "bar");
    expect(model.xDomain).toEqual(["1", "2", "3"]);
    expect(model.series[0]?.data[0]?.[0]).toBe("1");
  });

  it("keeps numeric x as numbers on a value axis", () => {
    const model = toSeries(REVENUE, { x: "week", y: "revenue" }, "line");
    expect(model.xDomain).toEqual([1, 2, 3]);
    expect(model.series[0]?.data[0]?.[0]).toBe(1);
  });

  it("keeps Date instances on a time axis and dedupes by instant", () => {
    const d1 = new Date("2026-01-05T00:00:00Z");
    const d2 = new Date("2026-01-12T00:00:00Z");
    const rows = [
      { week: d1, region: "North", v: 1 },
      { week: new Date("2026-01-05T00:00:00Z"), region: "South", v: 2 },
      { week: d2, region: "North", v: 3 },
    ];
    const model = toSeries(
      rows,
      { x: "week", y: "v", series: "region" },
      "line",
    );
    expect(model.xDomain).toEqual([d1, d2]);
    expect(model.series[0]?.data).toEqual([
      [d1, 1],
      [d2, 3],
    ]);
    expect(model.series[1]?.data).toEqual([
      [d1, 2],
      [d2, null],
    ]);
  });
});
