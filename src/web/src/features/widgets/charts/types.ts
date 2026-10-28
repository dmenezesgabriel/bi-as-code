import type { EChartsCoreOption, EChartsType } from "echarts/core";
import type { QueryShape } from "../../crossfilter/types";
import type { Row } from "../../data/types";
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
  readonly events?: EChartEvents;
}

/**
 * The echarts mouse-event params a chart interactor reads:
 * `componentType` distinguishes series marks from legend or axis parts;
 * `value` carries the datum's `[x, y, …]` tuple; `event.event` is the
 * native mouse event, so modifier keys drive accumulate-vs-replace.
 * Declared field-by-field (like `TooltipParam`) because the engine's own
 * callback signature is loose.
 */
export interface ChartClickParams {
  readonly componentType?: string;
  readonly seriesIndex?: number;
  readonly dataIndex?: number;
  readonly name?: string;
  readonly value?: unknown;
  readonly event?: {
    readonly event?: {
      readonly shiftKey?: boolean;
      readonly metaKey?: boolean;
    };
  };
}

export type ChartClickHandler = (params: ChartClickParams) => void;

/**
 * One brush area from the echarts brush events, narrowed to the fields the
 * interval interactor reads: `coordRange` is the brushed extent in data
 * space — category indexes on a category axis, epoch millis on a time axis.
 * `panelId`/`xAxisIndex` bind the area to a coordinate system — echarts
 * fills them on a real drag; without one the area resolves as a global
 * pixel-range brush.
 */
export interface ChartBrushArea {
  readonly brushType?: string;
  readonly coordRange?: readonly [number, number];
  readonly panelId?: string;
  readonly xAxisIndex?: number;
}

/**
 * The echarts `brushSelected` params — a batch with one entry per brush
 * component, each carrying the live areas (throttled during the drag).
 */
export interface ChartBrushSelectedParams {
  readonly batch?: readonly {
    readonly areas?: readonly ChartBrushArea[];
  }[];
}

/** The echarts `brushEnd` params — the final areas of the drag gesture. */
export interface ChartBrushEndParams {
  readonly areas?: readonly ChartBrushArea[];
}

export type ChartBrushSelectedHandler = (
  params: ChartBrushSelectedParams,
) => void;

export type ChartBrushEndHandler = (params: ChartBrushEndParams) => void;

/**
 * The echarts `legendselectchanged` params — the `legendToggleSelect`
 * action's payload: `name` is the toggled legend item, `selected` the full
 * name → enabled map across every legend component. The select-all and
 * inverse-select gestures arrive as separate event types, unreachable here
 * — our legend renders no `selector` buttons.
 */
export interface ChartLegendSelectParams {
  readonly name?: string;
  readonly selected?: Readonly<Record<string, boolean>>;
}

export type ChartLegendSelectHandler = (
  params: ChartLegendSelectParams,
) => void;

/**
 * What a legend toggle predicates on a `select="crossfilter"` chart:
 * `field` is the bound `series` column, `values` maps each rendered legend
 * name back to the raw series-column cell (legend names are `String(value)`
 * keys — the map keeps non-string columns binding their real values).
 */
export interface LegendTarget {
  readonly field: string;
  readonly values: ReadonlyMap<string, unknown>;
}

/**
 * A chart whose cross-filtered re-query aggregates in SQL: `query` shapes
 * the coordinator's re-query (aggregate rows, not the fence's raw rows) and
 * `model` projects those rows into the same model the raw-row `model`
 * builds from the registry's unfiltered fence.
 */
export interface ChartAggregate<M> {
  readonly query: QueryShape;
  readonly model: (rows: readonly Row[]) => M;
}

/**
 * The axis a chart's interval brush predicates, supplied per chart kind:
 * `value`/`time` axes convert `coordRange` directly (time epochs wrap to
 * `Date`), a `category` axis maps covered indexes through `domain` into a
 * value list, and the histogram's `bins` axis maps them to the bin-edge
 * window of the measured column.
 */
export type BrushAxis =
  | { readonly kind: "value" | "time"; readonly field: string }
  | {
      readonly kind: "category";
      readonly field: string;
      readonly domain: readonly unknown[];
    }
  | {
      readonly kind: "bins";
      readonly field: string;
      readonly bins: readonly HistogramBin[];
    };

/**
 * The echarts events `EChart` subscribes on the live instance — the
 * selection-gesture wiring a `select="crossfilter"` chart declares.
 * `optionApplied` runs after every `setOption` (mount included) so a brush
 * interactor can re-arm the cursor and restore its areas across repaints.
 */
export interface EChartEvents {
  readonly click?: ChartClickHandler;
  readonly brushSelected?: ChartBrushSelectedHandler;
  readonly brushEnd?: ChartBrushEndHandler;
  readonly legendSelectChanged?: ChartLegendSelectHandler;
  readonly optionApplied?: (instance: EChartsType) => void;
}

/**
 * The chart host node carries the live instance so browser tests can read
 * `getOption()`/`convertToPixel` — the same hook evidence exposes on its
 * wrapper element.
 */
export type EChartHostElement = HTMLDivElement & {
  echartsInstance?: EChartsType;
};

/**
 * Every colour a chart paints, resolved from the theme tokens in
 * `src/web/src/styles.css` for one mode. The canvas cannot inherit CSS, so
 * the values are read back and handed to the engine (ADR-0014).
 */
export interface ChartTokens {
  readonly foreground: string;
  readonly mutedForeground: string;
  /** Axis lines and ticks. */
  readonly axis: string;
  /** Split lines and heatmap cell borders. */
  readonly border: string;
  /** The page surface behind the chart — the heatmap ramp's zero end. */
  readonly background: string;
  readonly popover: string;
  readonly popoverBorder: string;
  /** A label inside a mark sits on the series fill, not on the page. */
  readonly labelInside: string;
  /** The categorical palette; series pick colours by index. */
  readonly series: readonly string[];
  /**
   * The heatmap ramp a widget without its own `colorScale` draws — one stop
   * ramps from `background` to it, two or more are the ramp as written.
   */
  readonly scale: readonly string[];
  /** The body font stack every chart text draws in. */
  readonly fontFamily: string;
}

/** Looks up one custom property (`--border`) and returns its value. */
export type ReadToken = (name: string) => string;

/** The three cartesian chart kinds this family ships. */
export type SeriesChartType = "bar" | "line" | "area";

/** ECharts x-axis type chosen by `inferXType` from the x cell values. */
export type XAxisKind = "category" | "value" | "time";

/**
 * One time-axis label as the engine laid it out: the tick (epoch ms) it
 * names, its centre's pixel x, and its painted width in px.
 */
export interface PlacedTimeLabel {
  readonly tick: number;
  readonly x: number;
  readonly width: number;
}

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

/**
 * The column bindings a series chart resolves against result rows. A
 * `stacked` spec draws a series with no row at an x as 0 instead of a gap:
 * ECharts stacks a null as no base, which punches a hole through every
 * layer above it.
 */
export interface SeriesSpec {
  readonly x: string;
  readonly y: string | readonly string[];
  readonly series?: string;
  readonly stacked?: StackedMode;
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
  /** Legend name → raw `series`-column cell; present iff `series` is bound. */
  readonly seriesValues?: ReadonlyMap<string, unknown>;
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
 * result shows. `select="crossfilter"` publishes the chart's selection
 * gestures as clauses into the interacted field's selection — mark clicks
 * predicate `x` — so every widget declaring that field in `filters`
 * re-queries while the chart skips its own clause (ADR-0004). `title` and
 * `subtitle` render as text above the plot — the title names the chart's
 * figure, the muted subtitle carries context such as the unit.
 */
export interface SeriesChartProps {
  readonly data: string;
  readonly x: string;
  readonly y: string | readonly string[];
  readonly series?: string;
  readonly filters?: FilterIds;
  readonly select?: "crossfilter";
  readonly stacked?: StackedMode;
  readonly labels?: boolean;
  readonly labelsFmt?: string;
  readonly color?: string;
  readonly seriesColors?: Readonly<Record<string, string>>;
  readonly xFmt?: string;
  readonly yFmt?: string;
  readonly title?: string;
  readonly subtitle?: string;
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
  /** Legend name → raw `series`-column cell; present iff `series` is bound. */
  readonly seriesValues?: ReadonlyMap<string, unknown>;
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
  /** Legend name → raw `series`-column cell; present iff `series` is bound. */
  readonly seriesValues?: ReadonlyMap<string, unknown>;
}

/** The column bindings a histogram resolves against result rows. */
export interface HistogramSpec {
  readonly value: string;
  readonly series?: string;
  readonly binCount?: number;
  readonly binWidth?: number;
}

/**
 * The bin geometry rule a `HistogramSpec` resolves to: a usable `binWidth`
 * wins, else a usable `binCount`, else neither (the rice rule). Both the
 * client-side binning and the SQL binning read the same rule.
 */
export interface BinRule {
  readonly binWidth?: number;
  readonly binCount?: number;
}

/**
 * The `<Histogram>` prop surface — the shared chart props minus `x`/`y`
 * (the binned `value` column stands in for both) and `stacked` (histogram
 * series always stack), plus `binCount`/`binWidth` steering the binning
 * (`binWidth` wins when both are set) and `valueFmt` formatting the value
 * axis and the tooltip's bin range. `yFmt`/`labelsFmt` format the counts; `xTitle`/`yTitle` name the
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
