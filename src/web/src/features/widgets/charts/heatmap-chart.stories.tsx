import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Row } from "../../data/types";
import type { SqlBlock } from "../../pages/types";
import { expect } from "storybook/test";
import {
  injectBrandStyle,
  withFilteredData,
  withQueryData,
  withThemeMode,
} from "../../../../.storybook/decorators";
import { Heatmap } from "./heatmap-chart";
import {
  TREND_ROWS,
  WEEKLY_TREND,
  appliedOption,
  dbWith,
  readyHost,
} from "./series-chart.fixture";
import type { HeatmapChartProps } from "./types";

type AxisOption = {
  xAxis?: { data?: unknown[]; name?: string }[];
  yAxis?: { data?: unknown[]; name?: string }[];
};

/** Two months × two weather kinds, the shape of the documented
 * `weather_days_2015` query: `month` is a Date, as DuckDB returns it. */
const WEATHER_DAYS: SqlBlock = {
  name: "weather_days",
  sql: "select month, weather, days from weather_days",
};
const WEATHER_ROWS: Row[] = [
  { month: new Date(Date.UTC(2015, 0, 1)), weather: "rain", days: 18 },
  { month: new Date(Date.UTC(2015, 0, 1)), weather: "sun", days: 4 },
  { month: new Date(Date.UTC(2015, 1, 1)), weather: "rain", days: 12 },
  { month: new Date(Date.UTC(2015, 1, 1)), weather: "sun", days: 9 },
];

/** Single-assertion play for the alert stories: the alert names the
 * offending value; the unit tests pin the full message. */
const alertPlay =
  (want: string): Story["play"] =>
  async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(want);
  };

const meta = {
  title: "Widgets/Charts/Heatmap",
  component: Heatmap,
  args: { data: "weekly_trend", x: "week", y: "region", value: "orders" },
} satisfies Meta<HeatmapChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Week columns × region rows, cell shade by orders — the visualMap strip
 * doubles as the legend. */
export const WeeklyGrid: Story = {
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const host = await readyHost(canvasElement);
    expect(host.querySelector("canvas")).not.toBeNull();
    expect(host).toHaveAttribute(
      "aria-label",
      "heatmap chart of orders by week and region",
    );
    const option = await appliedOption<{
      series?: { type?: string; data?: unknown[] }[];
      xAxis?: { type?: string; position?: string; data?: unknown[] }[];
      yAxis?: { type?: string; inverse?: boolean }[];
      visualMap?: {
        min?: number;
        max?: number;
        inRange?: { color?: string[] };
      }[];
    }>(canvasElement);
    expect(option.series?.[0]?.type).toBe("heatmap");
    expect(option.series?.[0]?.data).toHaveLength(6);
    expect(option.xAxis?.[0]?.type).toBe("category");
    expect(option.xAxis?.[0]?.position).toBe("top");
    expect(option.yAxis?.[0]?.inverse).toBe(true);
    expect(option.visualMap?.[0]?.min).toBe(90);
    expect(option.visualMap?.[0]?.max).toBe(140);
  },
};

/** `colorScale` with one color expands to a surface-anchored gradient. */
export const SingleColorScale: Story = {
  args: { colorScale: "#d97706" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      visualMap?: { inRange?: { color?: string[] } }[];
    }>(canvasElement);
    expect(option.visualMap?.[0]?.inRange?.color).toEqual([
      "#ffffff",
      "#d97706",
    ]);
  },
};

/** A sparse fence leaves the unobserved cells blank — no zero-fill. */
export const SparseGrid: Story = {
  decorators: [
    withQueryData(
      [WEEKLY_TREND],
      // South only observed week 1 — its weeks 2–3 cells stay blank.
      dbWith(
        TREND_ROWS.filter(
          (r) =>
            !(r.region === "South" && typeof r.week === "number" && r.week > 1),
        ),
      ),
    ),
  ],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { data?: unknown[] }[];
      yAxis?: { data?: unknown[] }[];
    }>(canvasElement);
    expect(option.yAxis?.[0]?.data).toEqual(["North", "South"]);
    expect(option.series?.[0]?.data).toHaveLength(4);
  },
};

/** `labels` prints each cell's `valueFmt`-formatted value. */
export const CellLabels: Story = {
  args: { labels: true, valueFmt: "num0" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: {
        label?: {
          show?: boolean;
          formatter?: (p: { value: number[] }) => string;
        };
      }[];
    }>(canvasElement);
    const label = option.series?.[0]?.label;
    expect(label?.formatter?.({ value: [0, 0, 95.4] })).toBe("95");
  },
};

/** An all-equal value column pins `visualMap` min==max — the ramp still
 * renders a single solid fill instead of collapsing. */
export const ConstantValue: Story = {
  decorators: [
    withQueryData(
      [WEEKLY_TREND],
      dbWith(TREND_ROWS.map((r) => ({ ...r, orders: 7 }))),
    ),
  ],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      visualMap?: { min?: number; max?: number }[];
    }>(canvasElement);
    expect(option.visualMap?.[0]?.min).toBe(7);
    expect(option.visualMap?.[0]?.max).toBe(7);
  },
};

/** The dark theme re-anchors the ramp on the dark surface — the "no data"
 * end blends into the dark `--background` instead of going white. */
export const Dark: Story = {
  decorators: [
    withThemeMode("dark"),
    withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS)),
  ],
  play: async ({ canvasElement }) => {
    // appliedOption waits for the ready host — the dark theme's presence is
    // implied by the ramp anchor, which only resolves to the dark surface
    // when mode is dark.
    const option = await appliedOption<{
      visualMap?: { inRange?: { color?: string[] } }[];
    }>(canvasElement);
    expect(option.visualMap?.[0]?.inRange?.color).toEqual([
      "#0a0a0a",
      "#0072b2",
    ]);
  },
};

type RampOption = { visualMap?: { inRange?: { color?: string[] } }[] };

/** A one-colour brand scale (`brand.scale` in `biac.config.ts`) ramps from
 * the surface to the brand colour on every heatmap without its own
 * `colorScale`. */
export const BrandScale: Story = {
  beforeEach: injectBrandStyle(":root, .light { --chart-scale: #1e40af; }"),
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<RampOption>(canvasElement);
    expect(option.visualMap?.[0]?.inRange?.color).toEqual([
      "#ffffff",
      "#1e40af",
    ]);
  },
};

/** A brand scale of two or more stops is the ramp as written, in dark mode
 * too. */
export const BrandScaleGradientDark: Story = {
  beforeEach: injectBrandStyle(
    ".dark { --chart-scale: #172554, #60a5fa, #dbeafe; }",
  ),
  decorators: [
    withThemeMode("dark"),
    withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS)),
  ],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<RampOption>(canvasElement);
    expect(option.visualMap?.[0]?.inRange?.color).toEqual([
      "#172554",
      "#60a5fa",
      "#dbeafe",
    ]);
  },
};

/** A widget's own `colorScale` wins over the brand scale. */
export const WidgetScaleOverBrand: Story = {
  args: { colorScale: "#d97706" },
  beforeEach: injectBrandStyle(":root, .light { --chart-scale: #1e40af; }"),
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<RampOption>(canvasElement);
    expect(option.visualMap?.[0]?.inRange?.color).toEqual([
      "#ffffff",
      "#d97706",
    ]);
  },
};

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=South` seeds the filter, one row of cells remains. */
export const Filtered: Story = {
  args: { filters: "region" },
  decorators: [withFilteredData([WEEKLY_TREND], TREND_ROWS, "region", "South")],
  play: async ({ canvasElement }) => {
    await readyHost(canvasElement);
    const option = await appliedOption<{
      series?: { data?: unknown[] }[];
      yAxis?: { data?: unknown[] }[];
    }>(canvasElement);
    expect(option.yAxis?.[0]?.data).toEqual(["South"]);
    expect(option.series?.[0]?.data).toHaveLength(3);
  },
};

/** `valueFmt` formats the tooltip and the ends of the colour strip. */
export const ValueFormat: Story = {
  args: { valueFmt: "usd0" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      visualMap?: { formatter?: (v: number) => string }[];
    }>(canvasElement);
    expect(option.visualMap?.[0]?.formatter?.(140)).toBe("$140");
  },
};

/** `labelsFmt` formats the cell labels only; the strip keeps `valueFmt`. */
export const LabelFormat: Story = {
  args: { labels: true, valueFmt: "num1", labelsFmt: "num0" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: {
        label?: { formatter?: (p: { value: number[] }) => string };
      }[];
      visualMap?: { formatter?: (v: number) => string }[];
    }>(canvasElement);
    expect(
      option.series?.[0]?.label?.formatter?.({ value: [0, 0, 95.4] }),
    ).toBe("95");
    expect(option.visualMap?.[0]?.formatter?.(95.4)).toBe("95.4");
  },
};

/** A list of colours runs from the first, at the lowest value, to the last. */
export const ColorScaleList: Story = {
  args: { colorScale: ["#2563eb", "#facc15", "#dc2626"] },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<RampOption>(canvasElement);
    expect(option.visualMap?.[0]?.inRange?.color).toEqual([
      "#2563eb",
      "#facc15",
      "#dc2626",
    ]);
  },
};

/** `xFmt` turns a Date column's labels into `Jan 1/15` instead of ISO days. */
export const XFormat: Story = {
  args: {
    data: "weather_days",
    x: "month",
    y: "weather",
    value: "days",
    xFmt: "shortdate",
  },
  decorators: [withQueryData([WEATHER_DAYS], dbWith(WEATHER_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<AxisOption>(canvasElement);
    expect(option.xAxis?.[0]?.data).toEqual(["Jan 1/15", "Feb 1/15"]);
  },
};

/** `yFmt` formats the row labels the same way. */
export const YFormat: Story = {
  args: {
    data: "weather_days",
    x: "weather",
    y: "month",
    value: "days",
    yFmt: "longdate",
  },
  decorators: [withQueryData([WEATHER_DAYS], dbWith(WEATHER_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<AxisOption>(canvasElement);
    expect(option.yAxis?.[0]?.data).toEqual([
      "January 1, 2015",
      "February 1, 2015",
    ]);
  },
};

/** `title` heads the chart and `subtitle` sits under it, above the grid. */
export const TitleAndSubtitle: Story = {
  args: { title: "Orders per week", subtitle: "Units" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText("Orders per week"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Units")).toBeInTheDocument();
  },
};

/** `xTitle` and `yTitle` name the two axes. */
export const AxisTitles: Story = {
  args: { xTitle: "Week", yTitle: "Region" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<AxisOption>(canvasElement);
    expect(option.xAxis?.[0]?.name).toBe("Week");
    expect(option.yAxis?.[0]?.name).toBe("Region");
  },
};

/** `legend={false}` hides the colour strip; the tooltip still reads values. */
export const NoLegend: Story = {
  args: { legend: false },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{ visualMap?: { show?: boolean }[] }>(
      canvasElement,
    );
    expect(option.visualMap?.[0]?.show).toBe(false);
  },
};

/** `height` sets the chart's height in pixels. */
export const Height: Story = {
  args: { height: 180 },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const host = await readyHost(canvasElement);
    expect(host.getBoundingClientRect().height).toBe(180);
  },
};

/** `renderer="svg"` draws SVG instead of a canvas. */
export const SvgRenderer: Story = {
  args: { renderer: "svg" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const host = await readyHost(canvasElement);
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.querySelector("canvas")).toBeNull();
  },
};

/** A `data` naming no fence alerts in the chart's place. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: alertPlay("ghost"),
};

/** A column the query does not return is named, with the columns it does. */
export const UnknownColumn: Story = {
  args: { value: "nope" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: alertPlay('"nope"'),
};

/** A format code the column cannot take names itself in the alert. */
export const UnknownFmt: Story = {
  args: { valueFmt: "bogus" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: alertPlay('fmt="bogus"'),
};

/** A query that returns no rows shows "0 rows" at the chart's height. */
export const NoRows: Story = {
  decorators: [withQueryData([WEEKLY_TREND], dbWith([]))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("0 rows")).toBeInTheDocument();
  },
};
