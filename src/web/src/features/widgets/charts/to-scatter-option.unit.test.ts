import { describe, expect, it } from "vitest";
import { FormatError } from "../value/types";
import {
  SCATTER_ROWS,
  ariaDescription,
  tooltipFormatter,
} from "./series-chart.fixture";
import { toScatterOption } from "./to-scatter-option";
import { toScatterSeries } from "./to-scatter-series";

const PROPS = { data: "q", x: "orders", y: "revenue" } as const;

describe("toScatterOption", () => {
  it("emits scatter series over a value x-axis", () => {
    const option = toScatterOption(
      toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
      PROPS,
    );
    const series = option.series as { type?: string; data?: unknown[] }[];
    expect(series[0]?.type).toBe("scatter");
    expect(series[0]?.data?.[0]).toEqual([120, 4800]);
    expect((option.xAxis as { type?: string }).type).toBe("value");
  });

  it("keeps string x values on a category axis with the domain", () => {
    const rows = [
      { x: "a", y: 1 },
      { x: "b", y: 2 },
    ];
    const option = toScatterOption(toScatterSeries(rows, { x: "x", y: "y" }), {
      data: "q",
      x: "x",
      y: "y",
    });
    const xAxis = option.xAxis as { type?: string; data?: unknown[] };
    expect(xAxis.type).toBe("category");
    expect(xAxis.data).toEqual(["a", "b"]);
  });

  it("uses a uniform 9px symbolSize when no size column is bound", () => {
    const option = toScatterOption(
      toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
      PROPS,
    );
    const series = option.series as { symbolSize?: unknown }[];
    expect(series[0]?.symbolSize).toBe(9);
  });

  it("scales symbolSize as sqrt(v/max)·35 when size is bound", () => {
    const option = toScatterOption(
      toScatterSeries(SCATTER_ROWS, {
        x: "orders",
        y: "revenue",
        size: "accounts",
      }),
      { ...PROPS, size: "accounts" },
    );
    const series = option.series as {
      symbolSize?: (value: unknown[]) => number;
    }[];
    const size = series[0]?.symbolSize;
    expect(typeof size).toBe("function");
    if (typeof size !== "function") throw new Error("symbolSize not a fn");
    expect(size([120, 4800, 18])).toBeCloseTo(35);
    expect(size([120, 4800, 4.5])).toBeCloseTo(17.5);
    expect(size([120, 4800, null])).toBe(0);
  });

  it("falls back to uniform size when every size cell is null", () => {
    const rows = [
      { x: 1, y: 2, accounts: null },
      { x: 2, y: 3, accounts: null },
    ];
    const option = toScatterOption(
      toScatterSeries(rows, { x: "x", y: "y", size: "accounts" }),
      { data: "q", x: "x", y: "y", size: "accounts" },
    );
    const series = option.series as { symbolSize?: unknown }[];
    expect(series[0]?.symbolSize).toBe(9);
  });

  it("uses an item tooltip naming x, y and size columns", () => {
    const option = toScatterOption(
      toScatterSeries(SCATTER_ROWS, {
        x: "orders",
        y: "revenue",
        size: "accounts",
      }),
      { ...PROPS, size: "accounts" },
    );
    expect((option.tooltip as { trigger?: string }).trigger).toBe("item");
    const html = tooltipFormatter(option)({
      seriesName: "North",
      marker: "●",
      value: [120, 4800, 14],
    });
    expect(html).toContain("North");
    expect(html).toContain("orders");
    expect(html).toContain("revenue");
    expect(html).toContain("accounts");
  });

  it("escapes html in tooltip values", () => {
    const rows = [{ x: "<b>x</b>", y: 1 }];
    const option = toScatterOption(toScatterSeries(rows, { x: "x", y: "y" }), {
      data: "q",
      x: "x",
      y: "y",
    });
    const html = tooltipFormatter(option)({
      seriesName: "y",
      value: ["<b>x</b>", 1],
    });
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("shows a legend once the chart has more than one series", () => {
    const model = toScatterSeries(SCATTER_ROWS, {
      x: "orders",
      y: "revenue",
      series: "region",
    });
    expect(
      toScatterOption(model, { ...PROPS, series: "region" }).legend,
    ).toBeDefined();
    expect(
      toScatterOption(model, { ...PROPS, series: "region", legend: false })
        .legend,
    ).toBeUndefined();
    expect(
      toScatterOption(
        toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
        PROPS,
      ).legend,
    ).toBeUndefined();
  });

  it("draws point labels when labels is set", () => {
    const option = toScatterOption(
      toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
      { ...PROPS, labels: true },
    );
    const series = option.series as { label?: { show?: boolean } }[];
    expect(series[0]?.label?.show).toBe(true);
  });

  it("paints a single-color palette and per-series overrides", () => {
    const model = toScatterSeries(SCATTER_ROWS, {
      x: "orders",
      y: "revenue",
      series: "region",
    });
    const colored = toScatterOption(model, {
      ...PROPS,
      series: "region",
      color: "#123456",
      seriesColors: { South: "#654321" },
    });
    expect(colored.color).toEqual(["#123456"]);
    const series = colored.series as { name?: string; color?: string }[];
    expect(series.find((s) => s.name === "South")?.color).toBe("#654321");
    expect(series.find((s) => s.name === "North")?.color).toBeUndefined();
  });

  it("describes the chart in the aria label", () => {
    expect(
      ariaDescription(
        toScatterOption(
          toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
          PROPS,
        ),
      ),
    ).toBe("scatter chart of revenue by orders");
    expect(
      ariaDescription(
        toScatterOption(
          toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
          { ...PROPS, title: "Orders vs revenue" },
        ),
      ),
    ).toBe("Orders vs revenue");
  });

  it.each(["xFmt", "yFmt", "sizeFmt", "labelsFmt"] as const)(
    "throws FormatError for a bogus %s code",
    (prop) => {
      expect(() =>
        toScatterOption(
          toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
          { ...PROPS, size: "accounts", [prop]: "bogus" },
        ),
      ).toThrowError(FormatError);
    },
  );
});
