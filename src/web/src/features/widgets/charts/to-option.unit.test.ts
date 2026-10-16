import { describe, expect, it } from "vitest";
import { LIGHT_CHART_TOKENS } from "./chart-tokens.fixture";
import { FormatError } from "../value/types";
import { toChartOption } from "./to-option";
import type { SeriesChartProps, SeriesModel } from "./types";

const CATEGORIES: SeriesModel = {
  xDomain: ["North", "South", "West"],
  xType: "category",
  series: [
    {
      name: "revenue",
      data: [
        ["North", 4800],
        ["South", 3700],
        ["West", 6100],
      ],
    },
  ],
};

const TWO_SERIES: SeriesModel = {
  xDomain: [1, 2, 3],
  xType: "value",
  series: [
    {
      name: "North",
      data: [
        [1, 40],
        [2, 44],
        [3, null],
      ],
    },
    {
      name: "South",
      data: [
        [1, 25],
        [2, null],
        [3, 27],
      ],
    },
  ],
};

const RAW_STACK: SeriesModel = {
  xDomain: ["W1", "W2"],
  xType: "category",
  series: [
    {
      name: "North",
      data: [
        ["W1", 40],
        ["W2", 60],
      ],
    },
    {
      name: "South",
      data: [
        ["W1", 60],
        ["W2", 40],
      ],
    },
  ],
};

const PROPS: SeriesChartProps = { data: "orders", x: "region", y: "revenue" };

/* Structural views over the loosely-typed EChartsCoreOption — the option is
 * a plain object until `setOption` consumes it, so tests assert its shape
 * through narrow local types instead of echarts' `any`-ish unions. */
interface AxisProbe {
  type?: string;
  data?: readonly unknown[];
  name?: string;
  min?: number;
  max?: number;
  boundaryGap?: unknown;
  minInterval?: number;
  axisLabel?: { formatter?: (value: never, index: number) => string };
}
interface SeriesProbe {
  name?: string;
  type?: string;
  stack?: string;
  data?: readonly unknown[];
  color?: string;
  barMaxWidth?: number;
  symbolSize?: number;
  areaStyle?: Record<string, unknown>;
  itemStyle?: { opacity?: number };
  label?: {
    show?: boolean;
    position?: string;
    color?: string;
    formatter?: (params: { value?: unknown }) => string;
  };
  labelLayout?: { hideOverlap?: boolean };
}
interface TooltipParam {
  seriesName?: string;
  marker?: string;
  value?: unknown;
  axisValue?: unknown;
  seriesIndex?: number;
}
interface OptionProbe {
  grid?: {
    top?: number;
    outerBoundsMode?: string;
    outerBoundsContain?: string;
  };
  xAxis?: AxisProbe;
  yAxis?: AxisProbe;
  series?: SeriesProbe[];
  legend?: { top?: number; show?: boolean };
  title?: { text?: string };
  aria?: { enabled?: boolean; label?: { description?: string } };
  tooltip?: {
    trigger?: string;
    formatter?: (params: TooltipParam | TooltipParam[]) => string;
  };
  color?: string[];
}

function probe(model: SeriesModel, props: Partial<SeriesChartProps> = {}) {
  return toChartOption(
    model,
    "bar",
    { ...PROPS, ...props },
    LIGHT_CHART_TOKENS,
  ) as OptionProbe;
}

describe("toChartOption axes", () => {
  it("puts the domain on a category x axis and keeps echarts' band padding", () => {
    const option = probe(CATEGORIES);
    expect(option.xAxis?.type).toBe("category");
    expect(option.xAxis?.data).toEqual(["North", "South", "West"]);
    expect(option.xAxis?.boundaryGap).toBe(true);
  });

  it("leaves a value x axis position-driven with a small edge pad", () => {
    const option = probe(TWO_SERIES);
    expect(option.xAxis?.type).toBe("value");
    expect(option.xAxis?.data).toBeUndefined();
    expect(option.xAxis?.boundaryGap).toEqual(["1%", "2%"]);
  });

  it("names the axes from xTitle/yTitle", () => {
    const option = probe(CATEGORIES, { xTitle: "Region", yTitle: "Revenue" });
    expect(option.xAxis?.name).toBe("Region");
    expect(option.yAxis?.name).toBe("Revenue");
  });

  it("formats y ticks with yFmt and x ticks with xFmt", () => {
    const option = probe(CATEGORIES, { yFmt: "usd0" });
    expect(option.yAxis?.axisLabel?.formatter?.(4800 as never, 0)).toBe(
      "$4,800",
    );
    expect(option.xAxis?.axisLabel?.formatter).toBeUndefined();
  });

  it("formats time-axis ticks from epoch milliseconds as dates", () => {
    const model: SeriesModel = {
      xDomain: [new Date(2026, 0, 5), new Date(2026, 0, 12)],
      xType: "time",
      series: [
        {
          name: "orders",
          data: [
            [new Date(2026, 0, 5), 40],
            [new Date(2026, 0, 12), 44],
          ],
        },
      ],
    };
    const option = probe(model, { xFmt: "shortdate" });
    const epochMs = new Date(2026, 0, 5).getTime();
    expect(option.xAxis?.axisLabel?.formatter?.(epochMs as never, 0)).toBe(
      "Jan 5/26",
    );
  });
});

describe("toChartOption one unit per axis", () => {
  it("formats every y tick against the series range, zero staying bare", () => {
    const tick = probe(CATEGORIES).yAxis?.axisLabel?.formatter;

    expect([0, 1000, 3000, 6000].map((v) => tick?.(v as never, 0))).toEqual([
      "0",
      "1k",
      "3k",
      "6k",
    ]);
  });

  it("formats point labels against the same range as the ticks", () => {
    const option = probe(CATEGORIES, { labels: true });

    expect(label(option).formatter?.({ value: ["South", 3700] })).toBe("4k");
  });

  it("scales a stacked axis by its stack totals, not its segments", () => {
    const model: SeriesModel = {
      xDomain: ["W1"],
      xType: "category",
      series: [
        { name: "North", data: [["W1", 2000]] },
        { name: "South", data: [["W1", 3000]] },
      ],
    };

    const stacked = probe(model, { stacked: true, labels: true });
    const grouped = probe(model, { labels: true });

    expect(stacked.yAxis?.axisLabel?.formatter?.(2000 as never, 0)).toBe("2k");
    expect(label(stacked).formatter?.({ value: ["W1", 2000] })).toBe("2k");
    expect(grouped.yAxis?.axisLabel?.formatter?.(2000 as never, 0)).toBe(
      "2,000",
    );
  });

  it("formats value x ticks against the x domain", () => {
    const model: SeriesModel = {
      xDomain: [1000, 9000],
      xType: "value",
      series: [
        {
          name: "orders",
          data: [
            [1000, 4],
            [9000, 6],
          ],
        },
      ],
    };

    const tick = probe(model).xAxis?.axisLabel?.formatter;

    expect(tick?.(2000 as never, 0)).toBe("2k");
  });

  it("leaves an explicit preset untouched by the range", () => {
    const tick = probe(CATEGORIES, { yFmt: "usd0" }).yAxis?.axisLabel
      ?.formatter;

    expect(tick?.(3000 as never, 0)).toBe("$3,000");
  });

  it("keeps the tooltip on the value's own magnitude", () => {
    const html = probe(CATEGORIES).tooltip?.formatter?.([
      { seriesName: "revenue", value: ["South", 3700] },
    ]);

    expect(html).toContain("revenue: 3,700");
  });
});

describe("toChartOption whole-number axes", () => {
  const FRACTIONAL: SeriesModel = {
    xDomain: [0.5, 1.5],
    xType: "value",
    series: [
      {
        name: "rate",
        data: [
          [0.5, 2.5],
          [1.5, 24.5],
        ],
      },
    ],
  };

  function line(model: SeriesModel, props: Partial<SeriesChartProps> = {}) {
    return toChartOption(
      model,
      "line",
      { ...PROPS, ...props },
      LIGHT_CHART_TOKENS,
    ) as OptionProbe;
  }

  it("ticks whole-number x and y axes on whole numbers", () => {
    const option = line(TWO_SERIES);

    expect(option.xAxis?.minInterval).toBe(1);
    expect(option.yAxis?.minInterval).toBe(1);
  });

  it("prints whole-number ticks without decimals", () => {
    const option = line(TWO_SERIES);

    expect(option.xAxis?.axisLabel?.formatter?.(2 as never, 0)).toBe("2");
    expect(option.yAxis?.axisLabel?.formatter?.(30 as never, 0)).toBe("30");
  });

  it("keeps a fractional axis' ticks and decimals", () => {
    const option = line(FRACTIONAL);

    expect(option.xAxis?.minInterval).toBeUndefined();
    expect(option.yAxis?.minInterval).toBeUndefined();
    expect(option.yAxis?.axisLabel?.formatter?.(5 as never, 0)).toBe("5.0");
  });

  it("leaves a 100% stack's fraction axis free of a whole-number floor", () => {
    const option = line(RAW_STACK, { stacked: "100%" });

    expect(option.yAxis?.minInterval).toBeUndefined();
    expect(option.yAxis?.axisLabel?.formatter?.(0.4 as never, 0)).toBe("40%");
  });

  it("never floors a category axis", () => {
    expect(line(CATEGORIES).xAxis?.minInterval).toBeUndefined();
  });
});

describe("toChartOption series", () => {
  it("emits a bar series per model series with a bar width cap", () => {
    const option = probe(CATEGORIES);
    expect(option.series).toHaveLength(1);
    expect(option.series?.[0]?.type).toBe("bar");
    expect(option.series?.[0]?.name).toBe("revenue");
    expect(option.series?.[0]?.data).toEqual(CATEGORIES.series[0]?.data);
    expect(option.series?.[0]?.barMaxWidth).toBe(60);
    expect(option.series?.[0]?.stack).toBeUndefined();
  });

  it("maps the area type onto a line series with an area style", () => {
    const option = toChartOption(
      TWO_SERIES,
      "area",
      PROPS,
      LIGHT_CHART_TOKENS,
    ) as OptionProbe;
    expect(option.series?.[0]?.type).toBe("line");
    expect(option.series?.[0]?.areaStyle).toEqual({});
  });

  it("marks series stacked when stacked is true and omits it otherwise", () => {
    const stacked = probe(TWO_SERIES, { stacked: true });
    expect(stacked.series?.every((s) => s.stack === "total")).toBe(true);
    expect(probe(TWO_SERIES).series?.[0]?.stack).toBeUndefined();
  });

  it("normalizes 100% stacks to fractions keeping raw values, and pins a 0–1 percent axis", () => {
    const option = probe(RAW_STACK, { stacked: "100%", yFmt: "usd0" });
    expect(option.series?.[0]?.data).toEqual([
      ["W1", 0.4, 40],
      ["W2", 0.6, 60],
    ]);
    expect(option.series?.every((s) => s.stack === "total")).toBe(true);
    expect(option.yAxis?.max).toBe(1);
    expect(option.yAxis?.min).toBe(0);
    expect(option.yAxis?.axisLabel?.formatter?.(0.4 as never, 0)).toBe("40%");
  });

  it("hides line symbols by default and unhides them for labels", () => {
    const plain = toChartOption(
      TWO_SERIES,
      "line",
      PROPS,
      LIGHT_CHART_TOKENS,
    ) as OptionProbe;
    expect(plain.series?.[0]?.itemStyle?.opacity).toBe(0);

    const labeled = toChartOption(
      TWO_SERIES,
      "line",
      {
        ...PROPS,
        labels: true,
      },
      LIGHT_CHART_TOKENS,
    ) as OptionProbe;
    expect(labeled.series?.[0]?.itemStyle?.opacity).toBe(1);
    expect(labeled.series?.[0]?.symbolSize).toBe(0);
  });

  it("applies seriesColors per series name and color as the palette", () => {
    const option = probe(TWO_SERIES, {
      color: "#000000",
      seriesColors: { South: "#ff0000" },
    });
    expect(option.color).toEqual(["#000000"]);
    expect(option.series?.[0]?.color).toBeUndefined();
    expect(option.series?.[1]?.color).toBe("#ff0000");
  });
});

describe("toChartOption labels", () => {
  it("labels points on top for a bar chart with a yFmt-aware formatter", () => {
    const option = probe(CATEGORIES, { labels: true, yFmt: "usd0" });
    const label = option.series?.[0]?.label;
    expect(label?.show).toBe(true);
    expect(label?.position).toBe("top");
    expect(label?.formatter?.({ value: ["North", 4800] })).toBe("$4,800");
    expect(option.series?.[0]?.labelLayout?.hideOverlap).toBe(true);
  });

  it("labels stacked bar segments inside the band", () => {
    const option = probe(TWO_SERIES, { stacked: true, labels: true });
    expect(option.series?.[0]?.label?.position).toBe("inside");
  });

  it("colours a label inside a stacked bar with the inside-label token", () => {
    const tokens = { ...LIGHT_CHART_TOKENS, labelInside: "#fefefe" };

    const option = toChartOption(
      TWO_SERIES,
      "bar",
      { ...PROPS, stacked: true, labels: true },
      tokens,
    ) as OptionProbe;

    expect(option.series?.[0]?.label?.color).toBe("#fefefe");
  });

  it("leaves a label outside its mark to the theme's color", () => {
    const option = probe(CATEGORIES, { labels: true });

    const label = option.series?.[0]?.label;

    expect(label).not.toHaveProperty("color");
  });

  it("labels a 100% stack with the percentage unless labelsFmt says otherwise", () => {
    const option = probe(RAW_STACK, { stacked: "100%", labels: true });
    expect(
      option.series?.[0]?.label?.formatter?.({ value: ["W1", 0.4, 40] }),
    ).toBe("40%");
  });

  it("prefers labelsFmt over yFmt for point labels", () => {
    const option = probe(CATEGORIES, {
      labels: true,
      yFmt: "usd0",
      labelsFmt: "num0k",
    });
    expect(label(option).formatter?.({ value: ["North", 4800] })).toBe("5k");
  });
});

function label(option: OptionProbe) {
  const l = option.series?.[0]?.label;
  if (!l) throw new Error("label config missing");
  return l;
}

describe("toChartOption legend, title and aria", () => {
  it("shows the legend only past one series unless the prop overrides", () => {
    expect(probe(CATEGORIES).legend).toBeUndefined();
    expect(probe(TWO_SERIES).legend).toMatchObject({ top: 0 });
    expect(probe(CATEGORIES, { legend: true }).legend).toMatchObject({
      top: 0,
    });
    expect(probe(TWO_SERIES, { legend: false }).legend).toBeUndefined();
  });

  it("never paints the title in the canvas — the chart frame renders it as text", () => {
    const titled = probe(TWO_SERIES, { title: "Revenue", subtitle: "USD" });
    expect(titled.title).toBeUndefined();
    expect(titled.legend).toMatchObject({ top: 0 });
  });

  it("reserves grid room for the legend alone, never for a title", () => {
    expect(probe(CATEGORIES, { title: "Revenue" }).grid?.top).toBe(8);
    expect(probe(TWO_SERIES, { title: "Revenue" }).grid?.top).toBe(36);
  });

  it("keeps axis titles inside the canvas, not only the tick labels", () => {
    const grid = probe(CATEGORIES, {
      xTitle: "Region",
      yTitle: "Revenue",
    }).grid;
    expect(grid?.outerBoundsMode).toBe("same");
    expect(grid?.outerBoundsContain).toBe("all");
  });

  it("describes the chart for aria with a generated summary, title or not", () => {
    expect(
      probe(CATEGORIES, { title: "Revenue" }).aria?.label?.description,
    ).toBe("bar chart of revenue by region");
    expect(probe(CATEGORIES).aria?.enabled).toBe(true);
    expect(probe(CATEGORIES).aria?.label?.description).toBe(
      "bar chart of revenue by region",
    );
    expect(
      toChartOption(
        TWO_SERIES,
        "line",
        {
          ...PROPS,
          x: "week",
          y: "orders",
          series: "region",
        },
        LIGHT_CHART_TOKENS,
      ) as OptionProbe,
    ).toMatchObject({
      aria: {
        label: { description: "line chart of orders by week, split by region" },
      },
    });
  });
});

describe("toChartOption tooltip", () => {
  function axisTooltip(option: OptionProbe, params: TooltipParam[]): string {
    const formatter = option.tooltip?.formatter;
    if (!formatter) throw new Error("tooltip formatter missing");
    return formatter(params);
  }

  it("triggers on axis and formats the title with xFmt", () => {
    const option = probe(CATEGORIES, { yFmt: "usd0" });
    expect(option.tooltip?.trigger).toBe("axis");
    const html = axisTooltip(option, [
      { seriesName: "revenue", marker: "<b/>", value: ["North", 4800] },
    ]);
    expect(html).toContain("North");
    expect(html).toContain("$4,800");
    expect(html).toContain("<b/>");
  });

  it("reads the raw value off a 100% tuple — percent plus original", () => {
    const option = probe(RAW_STACK, { stacked: "100%", yFmt: "usd0" });
    const html = axisTooltip(option, [
      { seriesName: "North", marker: "", value: ["W1", 0.4, 40] },
    ]);
    expect(html).toContain("40%");
    expect(html).toContain("$40");
  });

  it("escapes HTML in series names and axis values", () => {
    const option = probe(CATEGORIES);
    const html = axisTooltip(option, [
      {
        seriesName: "<img src=x onerror=alert(1)>",
        marker: "",
        value: ["<b>North</b>", 1],
      },
    ]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>North</b>");
    expect(html).toContain("&lt;img");
  });
});

describe("toChartOption validation", () => {
  it("throws FormatError eagerly on an unknown fmt code", () => {
    expect(() => probe(CATEGORIES, { yFmt: "bogus" })).toThrow(FormatError);
    expect(() => probe(CATEGORIES, { xFmt: "bogus" })).toThrow(FormatError);
    expect(() => probe(CATEGORIES, { labelsFmt: "bogus" })).toThrow(
      FormatError,
    );
  });

  it("rejects a date fmt against numeric y values", () => {
    expect(() => probe(CATEGORIES, { yFmt: "hms" })).toThrow(FormatError);
  });
});
