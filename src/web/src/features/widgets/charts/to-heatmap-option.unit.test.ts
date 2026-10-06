import { describe, expect, it } from "vitest";
import { FormatError } from "../value/types";
import {
  TREND_ROWS,
  ariaDescription,
  tooltipFormatter,
} from "./series-chart.fixture";
import { toHeatmap } from "./to-heatmap";
import { toHeatmapOption } from "./to-heatmap-option";

const PROPS = {
  data: "q",
  x: "week",
  y: "region",
  value: "orders",
} as const;

function option(
  props: Parameters<typeof toHeatmapOption>[1] = PROPS,
  rows = TREND_ROWS,
  mode: "light" | "dark" = "light",
) {
  return toHeatmapOption(
    toHeatmap(rows, { x: props.x, y: props.y, value: props.value }),
    props,
    mode,
  );
}

describe("toHeatmapOption", () => {
  it("emits a heatmap series over two category axes, x on top, y inverted", () => {
    const model = toHeatmap(TREND_ROWS, PROPS);
    const opt = toHeatmapOption(model, PROPS, "light");
    const xAxis = opt.xAxis as {
      type?: string;
      position?: string;
      data?: unknown[];
    };
    const yAxis = opt.yAxis as {
      type?: string;
      inverse?: boolean;
      data?: unknown[];
    };
    const series = opt.series as { type?: string; data?: unknown[] }[];
    expect(xAxis.type).toBe("category");
    expect(xAxis.position).toBe("top");
    // Category data is stringified — a numeric category must not reach
    // ECharts as a number (it would read as an ordinal index).
    expect(xAxis.data).toEqual(["1", "2", "3"]);
    expect(yAxis.type).toBe("category");
    expect(yAxis.inverse).toBe(true);
    expect(yAxis.data).toEqual(["North", "South"]);
    expect(series[0]?.type).toBe("heatmap");
    // The series mirrors the model's cells as copied tuples.
    expect(series[0]?.data).toEqual(model.cells.map((c) => [...c]));
  });

  it("drives a continuous visualMap strip from the observed min/max", () => {
    const visualMap = option().visualMap as {
      min?: number;
      max?: number;
      calculable?: boolean;
      orient?: string;
      show?: boolean;
      inRange?: { color?: unknown };
    };
    expect(visualMap.min).toBe(90);
    expect(visualMap.max).toBe(140);
    expect(visualMap.calculable).toBe(false);
    expect(visualMap.orient).toBe("horizontal");
    // The default ramp anchors on the light surface to the first series
    // accent so the "no data" end blends into the page.
    expect(visualMap.inRange?.color).toEqual(["#ffffff", "#2563eb"]);
  });

  it("re-anchors the default ramp on the dark surface in dark mode", () => {
    const visualMap = option(PROPS, TREND_ROWS, "dark").visualMap as {
      inRange?: { color?: unknown };
    };
    expect(visualMap.inRange?.color).toEqual(["#0a0a0a", "#2563eb"]);
  });

  it("expands a lone colorScale color to [surface, color] per mode", () => {
    const light = option({ ...PROPS, colorScale: "#f59e0b" }).visualMap as {
      inRange?: { color?: unknown };
    };
    const dark = option(
      { ...PROPS, colorScale: ["#f59e0b"] },
      TREND_ROWS,
      "dark",
    ).visualMap as { inRange?: { color?: unknown } };
    expect(light.inRange?.color).toEqual(["#ffffff", "#f59e0b"]);
    expect(dark.inRange?.color).toEqual(["#0a0a0a", "#f59e0b"]);
  });

  it("passes a multi-color colorScale through verbatim", () => {
    const visualMap = option({
      ...PROPS,
      colorScale: ["#fef3c7", "#d97706", "#7c2d12"],
    }).visualMap as { inRange?: { color?: unknown } };
    expect(visualMap.inRange?.color).toEqual(["#fef3c7", "#d97706", "#7c2d12"]);
  });

  it("labels the strip ends with valueFmt and hides it on legend=false", () => {
    const shown = option({ ...PROPS, valueFmt: "usd0" }).visualMap as {
      show?: boolean;
      text?: unknown[];
    };
    expect(shown.show).not.toBe(false);
    expect(shown.text).toEqual(["$140", "$90"]);
    const hidden = option({ ...PROPS, legend: false }).visualMap as {
      show?: boolean;
    };
    expect(hidden.show).toBe(false);
  });

  it("stays a single pinned color when min equals max", () => {
    const flat = [
      { week: 1, region: "North", orders: 7 },
      { week: 1, region: "South", orders: 7 },
    ];
    const visualMap = option(PROPS, flat).visualMap as {
      min?: number;
      max?: number;
      inRange?: { color?: unknown };
    };
    expect(visualMap.min).toBe(7);
    expect(visualMap.max).toBe(7);
    expect(visualMap.inRange?.color).toEqual(["#ffffff", "#2563eb"]);
  });

  it("formats a cell tooltip with the x/y/value rows", () => {
    const opt = option({ ...PROPS, valueFmt: "num0", xFmt: "num0" });
    expect((opt.tooltip as { trigger?: string }).trigger).toBe("item");
    const html = tooltipFormatter(opt)({ value: [2, 1, 100] });
    expect(html).toContain("week");
    expect(html).toContain("3");
    expect(html).toContain("region");
    expect(html).toContain("South");
    expect(html).toContain("orders: 100");
  });

  it("escapes html in tooltip category labels", () => {
    const rows = [{ week: 1, region: "<b>x</b>", orders: 5 }];
    const html = tooltipFormatter(option(PROPS, rows))({
      value: [0, 0, 5],
    });
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("shows value labels only when labels is set", () => {
    const unlabeled = option().series as { label?: { show?: boolean } }[];
    expect(unlabeled[0]?.label?.show ?? false).toBe(false);
    const labeled = option({ ...PROPS, labels: true, valueFmt: "num0" })
      .series as { label?: { show?: boolean; formatter?: unknown } }[];
    expect(labeled[0]?.label?.show).toBe(true);
    const fmt = labeled[0]?.label?.formatter;
    expect(typeof fmt).toBe("function");
    expect(
      (fmt as (p: { value: unknown[] }) => string)({ value: [0, 0, 95.4] }),
    ).toBe("95");
  });

  it("describes the chart in the aria label", () => {
    expect(ariaDescription(option())).toBe(
      "heatmap chart of orders by week and region",
    );
    expect(ariaDescription(option({ ...PROPS, title: "Load" }))).toBe("Load");
  });

  it("reserves grid room for the strip only when shown", () => {
    const shown = option().grid as { bottom?: number };
    const hidden = option({ ...PROPS, legend: false }).grid as {
      bottom?: number;
    };
    expect(shown.bottom).toBeGreaterThan(hidden.bottom ?? 0);
  });

  it.each(["xFmt", "yFmt", "valueFmt", "labelsFmt"] as const)(
    "throws FormatError for a bogus %s code",
    (prop) => {
      expect(() => option({ ...PROPS, [prop]: "bogus" })).toThrowError(
        FormatError,
      );
    },
  );
});
