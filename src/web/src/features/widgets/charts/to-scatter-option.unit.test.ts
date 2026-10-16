import { describe, expect, it } from "vitest";
import { LIGHT_CHART_TOKENS } from "./chart-tokens.fixture";
import { FormatError } from "../value/types";
import {
  PALETTE_OVERRIDE_PROPS,
  SCATTER_ROWS,
  ariaDescription,
  paletteOverrides,
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
      LIGHT_CHART_TOKENS,
    );
    const series = option.series as { type?: string; data?: unknown[] }[];
    expect(series[0]?.type).toBe("scatter");
    expect(series[0]?.data?.[0]).toEqual([120, 4800]);
    expect((option.xAxis as { type?: string }).type).toBe("value");
  });

  it("names the axes from xTitle/yTitle", () => {
    const option = toScatterOption(
      toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
      { ...PROPS, xTitle: "Orders", yTitle: "Revenue" },
      LIGHT_CHART_TOKENS,
    );
    expect(option.xAxis).toMatchObject({
      name: "Orders",
      nameLocation: "middle",
    });
    expect(option.yAxis).toMatchObject({
      name: "Revenue",
      nameLocation: "end",
    });
  });

  it("keeps string x values on a category axis with the domain", () => {
    const rows = [
      { x: "a", y: 1 },
      { x: "b", y: 2 },
    ];
    const option = toScatterOption(
      toScatterSeries(rows, { x: "x", y: "y" }),
      {
        data: "q",
        x: "x",
        y: "y",
      },
      LIGHT_CHART_TOKENS,
    );
    const xAxis = option.xAxis as { type?: string; data?: unknown[] };
    expect(xAxis.type).toBe("category");
    expect(xAxis.data).toEqual(["a", "b"]);
  });

  it("uses a uniform 9px symbolSize when no size column is bound", () => {
    const option = toScatterOption(
      toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
      PROPS,
      LIGHT_CHART_TOKENS,
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
      LIGHT_CHART_TOKENS,
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
      LIGHT_CHART_TOKENS,
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
      LIGHT_CHART_TOKENS,
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
    const option = toScatterOption(
      toScatterSeries(rows, { x: "x", y: "y" }),
      {
        data: "q",
        x: "x",
        y: "y",
      },
      LIGHT_CHART_TOKENS,
    );
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
      toScatterOption(model, { ...PROPS, series: "region" }, LIGHT_CHART_TOKENS)
        .legend,
    ).toBeDefined();
    expect(
      toScatterOption(
        model,
        { ...PROPS, series: "region", legend: false },
        LIGHT_CHART_TOKENS,
      ).legend,
    ).toBeUndefined();
    expect(
      toScatterOption(
        toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
        PROPS,
        LIGHT_CHART_TOKENS,
      ).legend,
    ).toBeUndefined();
  });

  it("draws point labels when labels is set", () => {
    const option = toScatterOption(
      toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
      { ...PROPS, labels: true },
      LIGHT_CHART_TOKENS,
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
    const colored = toScatterOption(
      model,
      { ...PROPS, ...PALETTE_OVERRIDE_PROPS },
      LIGHT_CHART_TOKENS,
    );
    expect(paletteOverrides(colored)).toEqual({
      palette: ["#123456"],
      south: "#654321",
      north: undefined,
    });
  });

  it("describes the chart in the aria label", () => {
    expect(
      ariaDescription(
        toScatterOption(
          toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
          PROPS,
          LIGHT_CHART_TOKENS,
        ),
      ),
    ).toBe("scatter chart of revenue by orders");
    expect(
      ariaDescription(
        toScatterOption(
          toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
          { ...PROPS, title: "Orders vs revenue" },
          LIGHT_CHART_TOKENS,
        ),
      ),
    ).toBe("scatter chart of revenue by orders");
  });

  it.each(["xFmt", "yFmt", "sizeFmt", "labelsFmt"] as const)(
    "throws FormatError for a bogus %s code",
    (prop) => {
      expect(() =>
        toScatterOption(
          toScatterSeries(SCATTER_ROWS, { x: "orders", y: "revenue" }),
          { ...PROPS, size: "accounts", [prop]: "bogus" },
          LIGHT_CHART_TOKENS,
        ),
      ).toThrowError(FormatError);
    },
  );
});

describe("toScatterOption one unit per axis", () => {
  const WIDE_ROWS = [
    { orders: 1000, revenue: 500 },
    { orders: 9000, revenue: 7000 },
  ];
  interface AxisProbe {
    minInterval?: number;
    axisLabel?: { formatter?: (value: unknown, index: number) => string };
  }
  interface LabelProbe {
    label?: { formatter?: (params: { value?: unknown }) => string };
  }

  function wideOption(props: { labels?: boolean; yFmt?: string } = {}) {
    return toScatterOption(
      toScatterSeries(WIDE_ROWS, { x: "orders", y: "revenue" }),
      { ...PROPS, ...props },
      LIGHT_CHART_TOKENS,
    );
  }

  it("formats x and y ticks against each axis' own range", () => {
    const option = wideOption();

    const xTick = (option.xAxis as AxisProbe).axisLabel?.formatter;
    const yTick = (option.yAxis as AxisProbe).axisLabel?.formatter;

    expect(xTick?.(2000, 0)).toBe("2k");
    expect(yTick?.(3000, 0)).toBe("3k");
  });

  it("formats point labels against the y range", () => {
    const series = wideOption({ labels: true }).series as LabelProbe[];

    const text = series[0]?.label?.formatter?.({ value: [1000, 3700] });

    expect(text).toBe("4k");
  });

  it("leaves an explicit preset untouched by the range", () => {
    const yAxis = wideOption({ yFmt: "usd0" }).yAxis as AxisProbe;

    expect(yAxis.axisLabel?.formatter?.(3000, 0)).toBe("$3,000");
  });

  it("ticks a whole-number x axis on whole numbers, without decimals", () => {
    const rows = [
      { orders: 4, revenue: 120.5 },
      { orders: 25, revenue: 980.25 },
    ];

    const option = toScatterOption(
      toScatterSeries(rows, { x: "orders", y: "revenue" }),
      PROPS,
      LIGHT_CHART_TOKENS,
    );
    const xAxis = option.xAxis as AxisProbe;
    const yAxis = option.yAxis as AxisProbe;

    expect(xAxis.minInterval).toBe(1);
    expect(xAxis.axisLabel?.formatter?.(5, 0)).toBe("5");
    expect(yAxis.minInterval).toBeUndefined();
  });

  it("keeps a fractional x axis' decimals", () => {
    const rows = [
      { orders: 0.5, revenue: 100 },
      { orders: 24.5, revenue: 900 },
    ];

    const option = toScatterOption(
      toScatterSeries(rows, { x: "orders", y: "revenue" }),
      PROPS,
      LIGHT_CHART_TOKENS,
    );
    const xAxis = option.xAxis as AxisProbe;

    expect(xAxis.minInterval).toBeUndefined();
    expect(xAxis.axisLabel?.formatter?.(5, 0)).toBe("5.0");
  });
});
