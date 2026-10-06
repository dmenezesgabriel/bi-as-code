import type { EChartsCoreOption, EChartsType } from "echarts/core";

/**
 * The option bag `<EChart>` hands to `setOption` — re-exported from
 * `echarts/core` so chart widgets and callers never import `echarts`
 * themselves (dep-cruiser confines the engine to this directory).
 */
export type ChartOption = EChartsCoreOption;

/** Render backend: `canvas` in the app, `svg` under jsdom (no canvas 2d). */
export type ChartRenderer = "canvas" | "svg";

/**
 * Props of the `<EChart>` engine wrapper: `option` is the full echarts
 * option (series included — updates are applied with `notMerge` so a
 * rebuilt option never leaves stale series); `height` sizes the host in px;
 * `renderer` selects the backend.
 */
export interface EChartProps {
  readonly option: ChartOption;
  readonly height?: number;
  readonly renderer?: ChartRenderer;
  readonly className?: string;
}

/**
 * The chart host node carries the live instance so browser tests can read
 * `getOption()`/`convertToPixel` — the same hook evidence exposes on its
 * wrapper element.
 */
export type EChartHostElement = HTMLDivElement & {
  echartsInstance?: EChartsType;
};

/** The three cartesian chart kinds this family ships. */
export type SeriesChartType = "bar" | "line" | "area";

/** ECharts x-axis type chosen by `inferXType` from the x cell values. */
export type XAxisKind = "category" | "value" | "time";

/**
 * One plotted point: `[x, y]` where `y` is the value ECharts draws (null =
 * a gap — the series has no value at this x). `toPercentageStack` appends a
 * third slot, `[x, fraction, rawY]`, so a `"100%"` tooltip can read the
 * un-normalized value off the data item itself.
 */
export type SeriesPoint = readonly [
  x: unknown,
  y: number | null,
  rawY?: number | null,
];

/** One named series of domain-aligned points, ready for `to-option`. */
export interface ChartSeries {
  readonly name: string;
  readonly data: readonly SeriesPoint[];
}

/** The column bindings a series chart resolves against result rows. */
export interface SeriesSpec {
  readonly x: string;
  readonly y: string | readonly string[];
  readonly series?: string;
}

/**
 * The rows→series transform output: `xDomain` is every normalized x in
 * first-appearance order (SQL `order by` owns sorting); every `ChartSeries`
 * emits exactly one point per domain entry so stacked series line up.
 */
export interface SeriesModel {
  readonly xDomain: readonly unknown[];
  readonly xType: XAxisKind;
  readonly series: readonly ChartSeries[];
}

/**
 * The `stacked` prop value: `true` piles series on one stack; `"100%"`
 * normalizes each x to a share of its total (the model arrives
 * pre-normalized, raw values kept for tooltips); `false`/unset keeps the
 * series side by side.
 */
export type StackedMode = boolean | "100%";

/**
 * The shared prop surface of `<BarChart>`/`<LineChart>`/`<AreaChart>`:
 * `data` names a ```sql fence on the same page; `x`/`y`/`series` name result
 * columns (the fence owns the SQL — these are never expressions); `y`
 * accepts one column or an array, each array entry becoming a series.
 * `xFmt`/`yFmt`/`labelsFmt` are `formatValue` preset codes applied to the
 * axis ticks, tooltip and point labels; `color` repaints every series with
 * one palette, `seriesColors` overrides per series name. `legend` forces
 * the legend on or off — unset, it appears once the chart has more than
 * one series. `height` sizes the chart host and its state boxes in px.
 */
export interface SeriesChartProps {
  readonly data: string;
  readonly x: string;
  readonly y: string | readonly string[];
  readonly series?: string;
  readonly stacked?: StackedMode;
  readonly labels?: boolean;
  readonly labelsFmt?: string;
  readonly color?: string;
  readonly seriesColors?: Readonly<Record<string, string>>;
  readonly xFmt?: string;
  readonly yFmt?: string;
  readonly title?: string;
  readonly xTitle?: string;
  readonly yTitle?: string;
  readonly legend?: boolean;
  readonly height?: number;
}
