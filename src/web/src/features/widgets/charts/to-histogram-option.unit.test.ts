import { afterEach, describe, expect, it } from "vitest";
import * as echarts from "echarts/core";
import type { EChartsType } from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { LIGHT_CHART_TOKENS } from "./chart-tokens.fixture";
import { FormatError } from "../value/types";
import {
  PALETTE_OVERRIDE_PROPS,
  ariaDescription,
  paletteOverrides,
  tooltipFormatter,
} from "./series-chart.fixture";
import { toHistogram } from "./to-histogram";
import { chartTheme } from "./theme";
import { toHistogramOption } from "./to-histogram-option";
import type { ChartOption } from "./types";

// min 12, max 80; binCount 4 → width 17 → bins [12,29) [29,46) [46,63) [63,80]
const AMOUNTS = [12, 25, 30, 42, 48, 55, 68, 80].map((amount) => ({ amount }));

const REGIONAL = [
  { amount: 12, region: "North" },
  { amount: 25, region: "South" },
  { amount: 30, region: "North" },
  { amount: 42, region: "South" },
];

const PROPS = { data: "q", value: "amount" } as const;

echarts.use([BarChart, GridComponent, SVGRenderer]);

/** The echarts@6.1.0 internals that hold the labels an axis lays out. */
interface LaidOutChart {
  getModel(): {
    getComponent(
      type: "xAxis",
      index: 0,
    ): { axis: { getViewLabels(): { formattedLabel: string }[] } };
    getComponent(
      type: "grid",
      index: 0,
    ): { coordinateSystem: { getRect(): { x: number; width: number } } };
  };
}

/** The x axis' formatter applied to `ticks`, as echarts labels them. */
function xTickLabels(option: ChartOption, ticks: readonly number[]): string[] {
  const xAxis = option.xAxis as {
    axisLabel?: { formatter?: (value: number) => string };
  };
  const formatter = xAxis.axisLabel?.formatter;
  if (formatter === undefined) throw new Error("x axis has no formatter");
  return ticks.map((tick) => formatter(tick));
}

describe("toHistogramOption", () => {
  it("emits stacked gapless bars at each bin's midpoint on a value axis", () => {
    const option = toHistogramOption(
      toHistogram(AMOUNTS, { value: "amount", binCount: 4 }),
      PROPS,
      LIGHT_CHART_TOKENS,
    );
    const xAxis = option.xAxis as { type?: string; min?: number; max?: number };
    expect(xAxis).toMatchObject({ type: "value", min: 12, max: 80 });
    const series = option.series as {
      type?: string;
      stack?: string;
      barCategoryGap?: number;
      data?: unknown[];
    }[];
    expect(series[0]?.type).toBe("bar");
    expect(series[0]?.stack).toBe("total");
    expect(series[0]?.barCategoryGap).toBe(0);
    expect(series[0]?.data).toEqual([
      [20.5, 2],
      [37.5, 2],
      [54.5, 2],
      [71.5, 2],
    ]);
  });

  it("labels the value axis' ticks with valueFmt", () => {
    const option = toHistogramOption(
      toHistogram(AMOUNTS, { value: "amount", binCount: 4 }),
      { ...PROPS, valueFmt: "usd0" },
      LIGHT_CHART_TOKENS,
    );
    expect(xTickLabels(option, [20, 40, 60])).toEqual(["$20", "$40", "$60"]);
  });

  it("keeps integer ticks and a Frequency title on the y axis", () => {
    const option = toHistogramOption(
      toHistogram(AMOUNTS, { value: "amount" }),
      PROPS,
      LIGHT_CHART_TOKENS,
    );
    const yAxis = option.yAxis as {
      type?: string;
      minInterval?: number;
      name?: string;
      axisLabel?: { formatter?: (v: unknown) => string };
    };
    expect(yAxis.type).toBe("value");
    expect(yAxis.minInterval).toBe(1);
    expect(yAxis.name).toBe("Frequency");
    // Bare `num` would paint a count of 4 as "4.00"; counts stay integers.
    expect(yAxis.axisLabel?.formatter?.(4)).toBe("4");
    const titled = toHistogramOption(
      toHistogram(AMOUNTS, { value: "amount" }),
      { ...PROPS, yTitle: "Orders" },
      LIGHT_CHART_TOKENS,
    );
    expect((titled.yAxis as { name?: string }).name).toBe("Orders");
  });

  it("titles the axis tooltip with the bin range and rows with counts", () => {
    const option = toHistogramOption(
      toHistogram(REGIONAL, { value: "amount", series: "region", binCount: 2 }),
      { ...PROPS, series: "region", valueFmt: "num0" },
      LIGHT_CHART_TOKENS,
    );
    expect((option.tooltip as { trigger?: string }).trigger).toBe("axis");
    const html = tooltipFormatter(option)([
      { seriesName: "North", marker: "●", value: [19.5, 2], dataIndex: 0 },
      { seriesName: "South", marker: "○", value: [19.5, 0], dataIndex: 0 },
    ]);
    expect(html).toBe("12 – 27<br/>● North: 2<br/>○ South: 0");
  });

  it("escapes html in tooltip series names", () => {
    const rows = [
      { amount: 1, region: "<b>x</b>" },
      { amount: 2, region: "North" },
    ];
    const option = toHistogramOption(
      toHistogram(rows, { value: "amount", series: "region" }),
      { ...PROPS, series: "region" },
      LIGHT_CHART_TOKENS,
    );
    const html = tooltipFormatter(option)([
      { seriesName: "<b>x</b>", marker: "", value: 1, dataIndex: 0 },
    ]);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("shows a legend once the chart has more than one series", () => {
    const model = toHistogram(REGIONAL, { value: "amount", series: "region" });
    expect(
      toHistogramOption(
        model,
        { ...PROPS, series: "region" },
        LIGHT_CHART_TOKENS,
      ).legend,
    ).toBeDefined();
    expect(
      toHistogramOption(
        model,
        { ...PROPS, series: "region", legend: false },
        LIGHT_CHART_TOKENS,
      ).legend,
    ).toBeUndefined();
    expect(
      toHistogramOption(
        toHistogram(AMOUNTS, { value: "amount" }),
        PROPS,
        LIGHT_CHART_TOKENS,
      ).legend,
    ).toBeUndefined();
  });

  it("paints a single-color palette and per-series overrides", () => {
    const model = toHistogram(REGIONAL, { value: "amount", series: "region" });
    const colored = toHistogramOption(
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

  it("draws count labels inside the stacked bands when labels is set", () => {
    const option = toHistogramOption(
      toHistogram(REGIONAL, { value: "amount", series: "region" }),
      { ...PROPS, series: "region", labels: true },
      LIGHT_CHART_TOKENS,
    );
    const label = (
      option.series as { label?: { show?: boolean; position?: string } }[]
    )[0]?.label;
    expect(label?.show).toBe(true);
    expect(label?.position).toBe("inside");
  });

  it("describes the chart in the aria label", () => {
    expect(
      ariaDescription(
        toHistogramOption(
          toHistogram(AMOUNTS, { value: "amount" }),
          PROPS,
          LIGHT_CHART_TOKENS,
        ),
      ),
    ).toBe("histogram chart of amount");
    expect(
      ariaDescription(
        toHistogramOption(
          toHistogram(REGIONAL, { value: "amount", series: "region" }),
          { ...PROPS, series: "region" },
          LIGHT_CHART_TOKENS,
        ),
      ),
    ).toBe("histogram chart of amount, split by region");
    expect(
      ariaDescription(
        toHistogramOption(
          toHistogram(AMOUNTS, { value: "amount" }),
          {
            ...PROPS,
            title: "Order size",
          },
          LIGHT_CHART_TOKENS,
        ),
      ),
    ).toBe("histogram chart of amount");
  });

  it.each(["valueFmt", "yFmt", "labelsFmt"] as const)(
    "throws FormatError for a bogus %s code",
    (prop) => {
      expect(() =>
        toHistogramOption(
          toHistogram(AMOUNTS, { value: "amount" }),
          {
            ...PROPS,
            [prop]: "bogus",
          },
          LIGHT_CHART_TOKENS,
        ),
      ).toThrowError(FormatError);
    },
  );
});

describe("toHistogramOption one unit per axis", () => {
  it("formats every tick against the bins' whole span", () => {
    // min 0, max 8000; binCount 4 → edges 0, 2000, 4000, 6000, 8000
    const rows = [0, 2500, 4500, 8000].map((amount) => ({ amount }));

    const option = toHistogramOption(
      toHistogram(rows, { value: "amount", binCount: 4 }),
      PROPS,
      LIGHT_CHART_TOKENS,
    );

    expect(xTickLabels(option, [0, 2000, 4000, 6000])).toEqual([
      "0",
      "2k",
      "4k",
      "6k",
    ]);
  });

  it("labels whole ticks over fractional bin edges without decimals", () => {
    // min -1.6, max 35.6; binCount 6 → edges -1.6, 4.6, …; ticks 0, 10, 20, 30
    const rows = [-1.6, 12.2, 35.6].map((amount) => ({ amount }));

    const option = toHistogramOption(
      toHistogram(rows, { value: "amount", binCount: 6 }),
      PROPS,
      LIGHT_CHART_TOKENS,
    );

    expect(xTickLabels(option, [0, 10, 20, 30])).toEqual([
      "0",
      "10",
      "20",
      "30",
    ]);
  });

  it("scales a bare-num count axis by the stacked bin totals", () => {
    // One bin holds 60 North + 60 South — the stack reaches 120, where bare
    // `num` drops its decimal; either series alone (60) would keep one.
    const crowd = ["North", "South"].flatMap((region) =>
      Array.from({ length: 60 }, () => ({ amount: 5, region })),
    );
    const rows = [...crowd, { amount: 10, region: "North" }];

    const option = toHistogramOption(
      toHistogram(rows, { value: "amount", series: "region", binCount: 2 }),
      { ...PROPS, series: "region", yFmt: "num" },
      LIGHT_CHART_TOKENS,
    );
    const yAxis = option.yAxis as {
      axisLabel?: { formatter?: (v: unknown) => string };
    };

    expect(yAxis.axisLabel?.formatter?.(50)).toBe("50");
  });
});

describe("toHistogramOption laid out by echarts", () => {
  const charts: EChartsType[] = [];
  afterEach(() => charts.splice(0).forEach((chart) => chart.dispose()));

  /** A real engine laid out server-side at `width` px — no DOM box needed. */
  function laidOutChart(option: ChartOption, width: number): EChartsType {
    const chart = echarts.init(null, chartTheme(LIGHT_CHART_TOKENS), {
      renderer: "svg",
      ssr: true,
      width,
      height: 300,
    });
    charts.push(chart);
    chart.setOption(option);
    return chart;
  }

  /** The x labels a real engine lays out at `width` px. */
  function laidOutXLabels(option: ChartOption, width: number): string[] {
    const internals = laidOutChart(option, width) as unknown as LaidOutChart;
    const axis = internals.getModel().getComponent("xAxis", 0).axis;
    return axis.getViewLabels().map((label) => label.formattedLabel);
  }

  it("sits the outer bin edges flush with the plot's sides", () => {
    const option = toHistogramOption(
      toHistogram(AMOUNTS, { value: "amount", binCount: 4 }),
      PROPS,
      LIGHT_CHART_TOKENS,
    );
    const chart = laidOutChart(option, 600);
    const internals = chart as unknown as LaidOutChart;
    const plot = internals
      .getModel()
      .getComponent("grid", 0)
      .coordinateSystem.getRect();

    const [left, right] = [12, 80].map((edge) =>
      chart.convertToPixel({ xAxisIndex: 0 }, edge),
    );

    expect(left).toBeCloseTo(plot.x);
    expect(right).toBeCloseTo(plot.x + plot.width);
  });

  it.each([375, 1280])(
    "labels unround bin edges with distinct ticks at %i px",
    (width) => {
      // min 2700, max 6300; binCount 14 → width 257.14…, no round edge
      const rows = [2700, 4100, 6300].map((amount) => ({ amount }));
      const option = toHistogramOption(
        toHistogram(rows, { value: "amount", binCount: 14 }),
        PROPS,
        LIGHT_CHART_TOKENS,
      );

      const labels = laidOutXLabels(option, width);

      expect(labels.length).toBeGreaterThan(2);
      expect(new Set(labels).size).toBe(labels.length);
    },
  );
});
