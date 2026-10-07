import type { EChartsCoreOption, EChartsType } from "echarts/core";
import type { FilterIds } from "../../filters/filter-ids";

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
 * `renderer` selects the echarts backend — canvas in the app, `svg` under
 * jsdom (no canvas 2d); tests and stories pass it explicitly. `filters`
 * names the page filters whose predicates wrap the fence's query — a lone
 * id or a list; with no filter contributing, the registry's unfiltered
 * result shows.
 */
export interface SeriesChartProps {
  readonly data: string;
  readonly x: string;
  readonly y: string | readonly string[];
  readonly series?: string;
  readonly filters?: FilterIds;
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
  readonly renderer?: ChartRenderer;
}

/**
 * `SeriesChart`'s own props — the shared tag surface plus the chart kind the
 * `BarChart`/`LineChart`/`AreaChart` wrappers fix for their callers.
 */
export interface SeriesChartWidgetProps extends SeriesChartProps {
  readonly type: SeriesChartType;
}

/**
 * One plotted scatter point: `[x, y, size?]` — sparse (no domain padding:
 * scatter has no shared-x alignment to maintain); `null` y is an undrawn
 * point, `null` size draws at zero size (evidence's semantics).
 */
export type ScatterPoint = readonly [
  x: unknown,
  y: number | null,
  size?: number | null,
];

/**
 * One named scatter series of sparse points. `y` records the source column
 * — the tooltip labels its y row by it (with a `series` split the display
 * `name` reads "<series> - <y>", which can't be parsed back reliably).
 */
export interface ScatterSeries {
  readonly name: string;
  readonly y: string;
  readonly data: readonly ScatterPoint[];
}

/**
 * The sparse scatter model: `xDomain` still feeds a `category` axis (the
 * rare string-x case); on `value`/`time` axes the tuples carry everything.
 */
export interface ScatterModel {
  readonly xDomain: readonly unknown[];
  readonly xType: XAxisKind;
  readonly series: readonly ScatterSeries[];
}

/** The column bindings a scatter chart resolves against result rows. */
export interface ScatterSpec {
  readonly x: string;
  readonly y: string | readonly string[];
  readonly series?: string;
  readonly size?: string;
}

/**
 * The `<ScatterChart>` prop surface — the shared chart props minus `stacked`
 * (points don't stack), plus `size` naming the column that scales each
 * point and `sizeFmt` formatting it in the item tooltip.
 */
export interface ScatterChartProps extends Omit<SeriesChartProps, "stacked"> {
  readonly size?: string;
  readonly sizeFmt?: string;
}

/**
 * One dense histogram bin: a half-open `[start, end)` edge pair — except
 * the last, which closes on both ends so the column max lands inside it
 * (evidence's floor-based index overflows the max into a `binCount + 1`th
 * sliver; clamping keeps exactly `binCount` bins on the axis).
 */
export interface HistogramBin {
  readonly start: number;
  readonly end: number;
}

/** One named series' per-bin counts, aligned to `HistogramModel.bins`. */
export interface HistogramSeries {
  readonly name: string;
  readonly counts: readonly number[];
}

/**
 * The binned model: `bins` is the dense domain from min to max — interior
 * empties exist as zero-count slots so every series' `counts` aligns by
 * index — and `series` holds one entry per `series` value in
 * first-appearance order (`"Frequency"` when unbound).
 */
export interface HistogramModel {
  readonly bins: readonly HistogramBin[];
  readonly series: readonly HistogramSeries[];
}

/** The column bindings a histogram resolves against result rows. */
export interface HistogramSpec {
  readonly value: string;
  readonly series?: string;
  readonly binCount?: number;
  readonly binWidth?: number;
}

/**
 * The `<Histogram>` prop surface — the shared chart props minus `x`/`y`
 * (the binned `value` column stands in for both) and `stacked` (histogram
 * series always stack), plus `binCount`/`binWidth` steering the binning
 * (`binWidth` wins when both are set) and `valueFmt` formatting the bin
 * edges. `yFmt`/`labelsFmt` format the counts; `xTitle`/`yTitle` name the
 * axes (`yTitle` defaults to `"Frequency"`).
 */
export interface HistogramChartProps extends Omit<
  SeriesChartProps,
  "x" | "y" | "xFmt" | "stacked"
> {
  readonly value: string;
  readonly binCount?: number;
  readonly binWidth?: number;
  readonly valueFmt?: string;
}

/**
 * One heatmap cell: `[xIndex, yIndex, value]` — the indexes address the
 * model's category domains, `value` feeds the `visualMap` scale. Only
 * observed cells exist; an unobserved (x,y) pair leaves a blank cell.
 */
export type HeatmapCell = readonly [
  xIndex: number,
  yIndex: number,
  value: number,
];

/**
 * The heatmap model: `xDomain`/`yDomain` hold every distinct x/y cell in
 * first-appearance order (SQL `order by` owns sorting) as the raw cell
 * values — stringification happens only at axis-data assembly so `xFmt`/
 * `yFmt` can still format `Date`s and numbers. `cells` is one `[xi,yi,v]`
 * tuple per observed row, sorted by y index ascending; duplicate (x,y)
 * pairs pass through (echarts last-wins — the fence's `group by` owns
 * dedup). `min`/`max` span the observed values for `visualMap`.
 */
export interface HeatmapModel {
  readonly xDomain: readonly unknown[];
  readonly yDomain: readonly unknown[];
  readonly cells: readonly HeatmapCell[];
  readonly min: number;
  readonly max: number;
}

/** The column bindings a heatmap resolves against result rows. */
export interface HeatmapSpec {
  readonly x: string;
  readonly y: string;
  readonly value: string;
}

/**
 * The `<Heatmap>` prop surface — the shared chart props minus `series`/
 * `stacked`/`color`/`seriesColors` (one heatmap series, no categorical
 * palette; `legend` toggles the `visualMap` strip), plus `y` narrowed to a
 * single category column, `value` naming the measured column, `valueFmt`
 * formatting cells/`visualMap` ends and `colorScale` the `inRange` ramp —
 * one color expands to `[surface, color]` per theme mode, two or more pass
 * through verbatim. `xFmt`/`yFmt` format the category labels.
 */
export interface HeatmapChartProps extends Omit<
  SeriesChartProps,
  "y" | "series" | "stacked" | "color" | "seriesColors"
> {
  readonly y: string;
  readonly value: string;
  readonly valueFmt?: string;
  readonly colorScale?: string | readonly string[];
}
