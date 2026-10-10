import { describe, expect, it } from "vitest";
import { ColumnError } from "../value/types";
import { binRule, fromHistogramBins, toHistogram } from "./to-histogram";

describe("toHistogram", () => {
  it("returns an empty model for no rows", () => {
    expect(toHistogram([], { value: "amount" })).toEqual({
      bins: [],
      series: [],
    });
  });

  it.each(["value", "series"] as const)(
    "throws ColumnError naming the missing %s column",
    (prop) => {
      const spec = { value: "amount", [prop]: "nope" };
      expect(() => toHistogram([{ amount: 10 }], spec)).toThrowError(
        ColumnError,
      );
      expect(() => toHistogram([{ amount: 10 }], spec)).toThrowError(/"nope"/);
    },
  );

  it("defaults to the rice-rule bin count", () => {
    // 27 values → ceil(2 · 27^⅓) = 6 bins
    const rows = Array.from({ length: 27 }, (_, i) => ({ amount: i * 10 }));
    const model = toHistogram(rows, { value: "amount" });
    expect(model.bins).toHaveLength(6);
    expect(model.bins[0]?.start).toBe(0);
    expect(model.bins.at(-1)?.end).toBe(260);
  });

  it("emits exactly binCount bins, clamping the max into the last", () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ amount: i * 10 }));
    const model = toHistogram(rows, { value: "amount", binCount: 10 });
    expect(model.bins).toHaveLength(10);
    expect(model.bins[0]).toEqual({ start: 0, end: 10 });
    expect(model.bins[9]).toEqual({ start: 90, end: 100 });
    // 100 lands in the last bin rather than an 11th overflow bin.
    expect(model.series[0]?.counts).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 2]);
  });

  it("derives the bin count from binWidth and lets it win over binCount", () => {
    const rows = [
      { amount: 0 },
      { amount: 15 },
      { amount: 50 },
      { amount: 95 },
    ];
    const model = toHistogram(rows, {
      value: "amount",
      binCount: 99,
      binWidth: 10,
    });
    expect(model.bins).toHaveLength(10);
    expect(model.bins[0]).toEqual({ start: 0, end: 10 });
    expect(model.bins[9]).toEqual({ start: 90, end: 100 });
    expect(model.series[0]?.counts).toEqual([1, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it("keeps interior empty bins as zero-count slots", () => {
    const rows = [{ amount: 0 }, { amount: 100 }];
    const model = toHistogram(rows, { value: "amount", binCount: 10 });
    expect(model.bins).toHaveLength(10);
    expect(model.series[0]?.counts).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it("counts per series over the shared bins, in first-appearance order", () => {
    const rows = [
      { amount: 0, region: "North" },
      { amount: 10, region: "South" },
      { amount: 100, region: "North" },
      { amount: 95, region: "South" },
    ];
    const model = toHistogram(rows, {
      value: "amount",
      series: "region",
      binCount: 10,
    });
    expect(model.series.map((s) => s.name)).toEqual(["North", "South"]);
    expect(model.series[0]?.counts).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(model.series[1]?.counts).toEqual([0, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(model.seriesValues).toEqual(
      new Map([
        ["North", "North"],
        ["South", "South"],
      ]),
    );
  });

  it("carries no seriesValues with the series column unbound", () => {
    const model = toHistogram([{ amount: 1 }, { amount: 2 }], {
      value: "amount",
    });
    expect(model.seriesValues).toBeUndefined();
  });

  it("groups a null series cell under 'Unknown'", () => {
    const rows = [
      { amount: 1, region: null },
      { amount: 2, region: "North" },
    ];
    const model = toHistogram(rows, { value: "amount", series: "region" });
    expect(model.series.map((s) => s.name)).toEqual(["Unknown", "North"]);
  });

  it("collapses to a single bin when every value is equal", () => {
    const model = toHistogram([{ amount: 42 }, { amount: 42 }], {
      value: "amount",
    });
    expect(model.bins).toEqual([{ start: 42, end: 43 }]);
    expect(model.series[0]?.counts).toEqual([2]);
  });

  it("drops non-numeric and null value cells", () => {
    const rows = [
      { amount: 1 },
      { amount: "abc" },
      { amount: null },
      { amount: 2 },
      { amount: "" },
      { amount: 3 },
    ];
    const model = toHistogram(rows, { value: "amount", binCount: 3 });
    expect(model.bins).toHaveLength(3);
    expect(model.series[0]?.counts).toEqual([1, 1, 1]);
  });

  it("returns an empty model when every value cell is non-numeric", () => {
    const model = toHistogram([{ amount: "x" }, { amount: null }], {
      value: "amount",
    });
    expect(model).toEqual({ bins: [], series: [] });
  });

  it("names the single series 'Frequency' when no series column is bound", () => {
    const model = toHistogram([{ amount: 1 }, { amount: 2 }], {
      value: "amount",
    });
    expect(model.series[0]?.name).toBe("Frequency");
  });
});

describe("binRule", () => {
  it("keeps binWidth and drops binCount when both are usable", () => {
    const rule = binRule({ value: "amount", binCount: 12, binWidth: 5 });

    expect(rule).toEqual({ binWidth: 5 });
  });

  it("floors binCount and ignores a non-positive binWidth", () => {
    const rule = binRule({ value: "amount", binCount: 12.7, binWidth: -1 });

    expect(rule).toEqual({ binCount: 12 });
  });

  it("resolves to the rice rule when neither prop is usable", () => {
    const rule = binRule({ value: "amount", binCount: Number.NaN });

    expect(rule).toEqual({});
  });
});

describe("fromHistogramBins", () => {
  const geometry = { lo: 0, bin_width: 10, bin_count: 4 };

  it("returns an empty model for no bin rows", () => {
    const model = fromHistogramBins([], { value: "amount" });

    expect(model).toEqual({ bins: [], series: [] });
  });

  it("rebuilds the dense domain and zero-fills bins the rows skip", () => {
    const rows = [
      { ...geometry, bin_index: 0, frequency: 3n },
      { ...geometry, bin_index: 3, frequency: 1n },
    ];

    const model = fromHistogramBins(rows, { value: "amount" });

    expect(model.bins).toEqual([
      { start: 0, end: 10 },
      { start: 10, end: 20 },
      { start: 20, end: 30 },
      { start: 30, end: 40 },
    ]);
    expect(model.series).toEqual([{ name: "Frequency", counts: [3, 0, 0, 1] }]);
    expect(model.seriesValues).toBeUndefined();
  });

  it("orders series by first appearance and maps legend names to cells", () => {
    const rows = [
      {
        ...geometry,
        bin_index: 0,
        series: "West",
        first_seen: 7n,
        frequency: 2n,
      },
      {
        ...geometry,
        bin_index: 1,
        series: null,
        first_seen: 9n,
        frequency: 1n,
      },
      {
        ...geometry,
        bin_index: 2,
        series: "East",
        first_seen: 1n,
        frequency: 4n,
      },
    ];

    const model = fromHistogramBins(rows, {
      value: "amount",
      series: "region",
    });

    expect(model.series).toEqual([
      { name: "East", counts: [0, 0, 4, 0] },
      { name: "West", counts: [2, 0, 0, 0] },
      { name: "Unknown", counts: [0, 1, 0, 0] },
    ]);
    expect([...(model.seriesValues ?? [])]).toEqual([
      ["East", "East"],
      ["West", "West"],
      ["Unknown", null],
    ]);
  });

  it("matches toHistogram over the same rows when no filter applies", () => {
    const raw = [0, 4, 9, 11, 25, 39, 40].map((amount) => ({ amount }));
    const expected = toHistogram(raw, { value: "amount", binCount: 4 });
    const rows = [
      { lo: 0, bin_width: 10, bin_count: 4, bin_index: 0, frequency: 3n },
      { lo: 0, bin_width: 10, bin_count: 4, bin_index: 1, frequency: 1n },
      { lo: 0, bin_width: 10, bin_count: 4, bin_index: 2, frequency: 1n },
      { lo: 0, bin_width: 10, bin_count: 4, bin_index: 3, frequency: 2n },
    ];

    const model = fromHistogramBins(rows, { value: "amount", binCount: 4 });

    expect(model).toEqual(expected);
  });
});
