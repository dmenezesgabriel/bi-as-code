import { formatValue } from "../value/format";
import type { FormatRange } from "../value/types";
import { toPercentageStack } from "./stack";
import type {
  ChartOption,
  ChartSeries,
  ChartTokens,
  HeatmapChartProps,
  HistogramChartProps,
  SeriesChartProps,
  SeriesChartType,
  SeriesModel,
  StackedMode,
  XAxisKind,
} from "./types";
import { axisValueRange, seriesValueRange } from "./value-range";

/**
 * The echarts params one hovered point contributes to an axis tooltip: the
 * field subset we read, declared so the formatter stays typed against the
 * engine's loose callback signature.
 */
export interface TooltipParam {
  readonly seriesName?: string;
  readonly marker?: string;
  readonly value?: unknown;
  readonly data?: unknown;
  readonly axisValue?: unknown;
  readonly dataIndex?: number;
}

/**
 * Assembles the full `setOption` payload for a series chart: typed axes,
 * stacked/normalized series, axis tooltip, legend and the aria
 * description. `props.stacked === "100%"` normalizes the model here —
 * `toSeries` always emits raw values so tooltips keep the un-normalized
 * number on the point's third slot. Ticks and point labels format against
 * one range per axis so they share a unit; the tooltip keeps each value's
 * own magnitude — a hover wants the exact number.
 *
 * `x`/`y`/`series` in `props` feed only the generated aria description —
 * the model already carries the resolved data.
 *
 * @example
 * toChartOption(toSeries(rows, { x: "week", y: "orders" }, "line"), "line", props, tokens)
 */
export function toChartOption(
  model: SeriesModel,
  type: SeriesChartType,
  props: SeriesChartProps,
  tokens: ChartTokens,
): ChartOption {
  assertFormats(model, props);
  const percentage = props.stacked === "100%";
  const series = percentage ? toPercentageStack(model.series) : model.series;
  const legend = props.legend ?? series.length > 1;
  const yRange = seriesValueRange(series, props.stacked);
  return {
    grid: gridOption(legend),
    xAxis: xAxisOption(model, props),
    yAxis: yAxisOption(props, percentage, yRange),
    series: series.map((s) => seriesOption(s, type, props, yRange, tokens)),
    ...chartChromeOption(props, legend),
    tooltip: {
      trigger: "axis",
      formatter: (params: TooltipParam | readonly TooltipParam[]) =>
        tooltipHtml(params, props, percentage),
    },
    aria: {
      enabled: true,
      label: { description: describeChart(type, props) },
    },
  };
}

/**
 * Validates every fmt prop against a sample of the column it will format —
 * a bad code throws `FormatError` at option-build time, where the widget's
 * state switch renders it as the chart's error face, instead of firing
 * inside an echarts render callback.
 */
function assertFormats(model: SeriesModel, props: SeriesChartProps): void {
  probeFormat(props.xFmt, xSample(model));
  probeFormat(props.yFmt, cellSample(model.series, 1));
  probeFormat(props.labelsFmt, cellSample(model.series, 1));
}

/**
 * Probes one fmt prop against a representative cell — skips the probe when
 * the prop is unset, so every fmt stays opt-in.
 */
export function probeFormat(fmt: string | undefined, sample: unknown): void {
  if (fmt !== undefined) formatValue(sample, fmt);
}

/**
 * The optional chrome every chart-family option shares: legend (gated on
 * `legend`) and a single-color palette — spread into the option literal
 * after `series`. The chart `title` is never painted here: `BoundChart`
 * renders it as text above the canvas.
 */
export function chartChromeOption(
  props: { readonly color?: string },
  legend: boolean,
): Record<string, unknown> {
  return {
    ...(legend ? { legend: { top: 0 } } : {}),
    ...(props.color !== undefined ? { color: [props.color] } : {}),
  };
}

/**
 * The first non-null value at `index` across every series' points — the
 * cell a fmt prop gets probed against (y at 1, scatter size at 2). Falls
 * back to `0` so a probe still exercises the code when every cell is null.
 */
export function cellSample(
  series: readonly { readonly data: readonly (readonly unknown[])[] }[],
  index: number,
): unknown {
  for (const s of series) {
    for (const point of s.data) {
      const value = point[index];
      if (value !== null && value !== undefined) return value;
    }
  }
  return 0;
}

export function xSample(model: {
  readonly xDomain: readonly unknown[];
  readonly xType: XAxisKind;
}): unknown {
  const first = model.xDomain.find((v) => v !== undefined && v !== null);
  if (first !== undefined) return first;
  return model.xType === "time" ? new Date(0) : 0;
}

/**
 * `formatValue` for render-callback sites: a probe already validated the
 * code, so a throw here means a mixed-type cell — degrade to the raw string
 * rather than breaking the chart mid-render. `range` is the span of the axis
 * the value sits on, so its labels share a unit.
 */
export function safeFormat(
  value: unknown,
  code?: string,
  range?: FormatRange,
): string {
  try {
    return formatValue(value, code, range);
  } catch {
    return String(value);
  }
}

/** The grid starts under the legend when one is on. */
export function gridOption(legend: boolean): Record<string, unknown> {
  const top = legend ? 36 : 8;
  // The grid shrinks until the axis labels *and* axis names fit the rect
  // (echarts 6 `outerBounds`; 'axisLabel' alone let an end-anchored y title
  // or a `nameGap`-offset x title paint past the canvas edge).
  return {
    top,
    left: 8,
    right: 16,
    bottom: 8,
    outerBoundsMode: "same",
    outerBoundsContain: "all",
  };
}

export function xAxisOption(
  model: { readonly xDomain: readonly unknown[]; readonly xType: XAxisKind },
  props: SeriesChartProps,
): Record<string, unknown> {
  const xRange =
    model.xType === "value" ? axisValueRange(model.xDomain) : undefined;
  const formatter = xTickFormatter(model, props.xFmt, xRange);
  return {
    type: model.xType,
    ...(model.xType === "category" ? { data: [...model.xDomain] } : {}),
    // Category bands pad by default; continuous axes pad 1%/2% so the first
    // and last tick labels aren't clipped at the plot edge.
    boundaryGap: model.xType === "category" ? true : ["1%", "2%"],
    ...(props.xTitle !== undefined
      ? { name: props.xTitle, nameLocation: "middle", nameGap: 30 }
      : {}),
    ...(formatter !== undefined ? { axisLabel: { formatter } } : {}),
    ...wholeTickOption(xRange),
    animation: false,
  };
}

/**
 * An axis over whole numbers ticks on whole numbers — echarts would
 * otherwise split a 0–3 axis at 0.5 and label a week or an order count that
 * cannot exist.
 */
function wholeTickOption(
  range: FormatRange | undefined,
): Record<string, unknown> {
  return range?.whole === true ? { minInterval: 1 } : {};
}

/**
 * The x-tick formatter per axis kind: a `time` axis keeps echarts' adaptive
 * labels unless `xFmt` pins one (ticks arrive as epoch ms — re-wrapped as
 * `Date` for `formatValue`); a `value` axis always gains the numeric default
 * so raw magnitudes read `4M` not `4000000`, scaled by the x domain so
 * every tick shares a unit; a `category` axis only formats when the author
 * asked (its labels are already strings).
 */
function xTickFormatter(
  model: { readonly xDomain: readonly unknown[]; readonly xType: XAxisKind },
  xFmt: string | undefined,
  xRange: FormatRange | undefined,
): ((value: unknown, index: number) => string) | undefined {
  if (model.xType === "value") return (v) => safeFormat(v, xFmt, xRange);
  if (xFmt === undefined) return undefined;
  if (model.xType === "time")
    return (v) => safeFormat(new Date(Number(v)), xFmt);
  return (v) => safeFormat(v, xFmt);
}

export function yAxisOption(
  props: { readonly yTitle?: string; readonly yFmt?: string },
  percentage: boolean,
  yRange?: FormatRange,
): Record<string, unknown> {
  // On a "100%" stack the axis is fractions — pin 0–1 and format ticks as
  // percents; the author's yFmt still applies to the raw values shown in the
  // tooltip and labels.
  const sideTitle = percentage && props.yTitle !== undefined;
  return {
    type: "value",
    animation: false,
    ...(percentage ? { min: 0, max: 1 } : wholeTickOption(yRange)),
    ...(props.yTitle !== undefined
      ? {
          name: props.yTitle,
          // A 100% axis tops out with the "100%" label colliding with an
          // end-anchored title — the side (rotated) title clears it.
          nameLocation: sideTitle ? "middle" : "end",
          ...(sideTitle ? { nameRotate: 90, nameGap: 50 } : {}),
        }
      : {}),
    axisLabel: {
      formatter: (v: unknown) =>
        safeFormat(v, percentage ? "pct0" : props.yFmt, yRange),
    },
  };
}

function seriesOption(
  series: ChartSeries,
  type: SeriesChartType,
  props: SeriesChartProps,
  yRange: FormatRange | undefined,
  tokens: ChartTokens,
): Record<string, unknown> {
  const echartsType = type === "area" ? "line" : type;
  const lineLike = echartsType === "line";
  return {
    name: series.name,
    type: echartsType,
    // Copy points — echarts may reorder/mutate series data; the model belongs
    // to the caller.
    data: series.data.map((point) => [...point]),
    ...(props.stacked ? { stack: "total" } : {}),
    ...(type === "area" ? { areaStyle: {} } : {}),
    ...(type === "bar" ? { barMaxWidth: 60 } : {}),
    ...(props.seriesColors?.[series.name] !== undefined
      ? { color: props.seriesColors[series.name] }
      : {}),
    ...(lineLike ? lineOption(props.labels === true) : {}),
    ...(props.labels ? labelOption(type, props, yRange, tokens) : {}),
    emphasis: {
      focus: "series",
      blurScope: "coordinateSystem",
      ...(lineLike
        ? { lineStyle: { width: 3 }, itemStyle: { opacity: 1 } }
        : {}),
    },
  };
}

/**
 * Line/area defaults: markers exist for hover/tooltip but stay invisible to
 * keep dense series readable. When `labels` is on, echarts ties point-label
 * visibility to symbol opacity — so opacity comes back to 1 and the dot is
 * hidden by a zero `symbolSize` instead.
 */
function lineOption(labeled: boolean): Record<string, unknown> {
  return {
    symbol: "circle",
    symbolSize: labeled ? 0 : 9,
    showSymbol: true,
    triggerEvent: true,
    lineStyle: { width: 1.75 },
    itemStyle: { opacity: labeled ? 1 : 0 },
  };
}

export function labelOption(
  type: SeriesChartType | "scatter",
  props: {
    readonly labelsFmt?: string;
    readonly yFmt?: string;
    readonly stacked?: StackedMode;
  },
  yRange: FormatRange | undefined,
  tokens: ChartTokens,
): Record<string, unknown> {
  const fmt =
    props.labelsFmt ?? (props.stacked === "100%" ? "pct0" : props.yFmt);
  const position = labelPosition(type, props.stacked);
  return {
    label: {
      show: true,
      position,
      ...(position === "inside" ? { color: tokens.labelInside } : {}),
      formatter: (p: { value?: unknown }) =>
        safeFormat(yOf(p.value), fmt, yRange),
    },
    labelLayout: { hideOverlap: true },
  };
}

function labelPosition(
  type: SeriesChartType | "scatter",
  stacked?: StackedMode,
): string {
  // A stacked bar's top edge belongs to the whole stack — a segment value
  // there misleads, so labels go inside the band.
  if (type === "bar") return stacked ? "inside" : "top";
  return "top";
}

function yOf(value: unknown): unknown {
  return Array.isArray(value) ? value[1] : value;
}

function tooltipHtml(
  params: TooltipParam | readonly TooltipParam[],
  props: SeriesChartProps,
  percentage: boolean,
): string {
  const list = Array.isArray(params) ? params : [params];
  const first = list[0];
  if (first === undefined) return "";
  const title = escapeHtml(safeFormat(pointTuple(first)[0], props.xFmt));
  const rows = list.map((p) => {
    const [, y, raw] = pointTuple(p);
    const shown = safeFormat(raw ?? y, props.yFmt);
    const text =
      percentage && typeof y === "number"
        ? `${safeFormat(y, "pct0")} (${shown})`
        : shown;
    return `${p.marker ?? ""} ${escapeHtml(p.seriesName)}: ${escapeHtml(text)}`;
  });
  return `${title}<br/>${rows.join("<br/>")}`;
}

/**
 * The `[x, y, rawY?]` tuple behind a tooltip param. `param.value` carries it
 * for array-typed series data; fall back to `data`, then to the axis pair.
 */
function pointTuple(param: TooltipParam): readonly unknown[] {
  const v = param.value ?? param.data;
  if (Array.isArray(v)) return v;
  return [param.axisValue, v];
}

export function describeChart(
  type: SeriesChartType | "scatter" | "histogram" | "heatmap",
  props: SeriesChartProps | HistogramChartProps | HeatmapChartProps,
): string {
  const split =
    "series" in props && props.series !== undefined
      ? `, split by ${props.series}`
      : "";
  // A heatmap binds x/y/value — its description names all three columns; a
  // histogram binds `value` alone (no x) and reads the distributed column.
  if ("value" in props && "x" in props) {
    return `heatmap chart of ${props.value} by ${props.x} and ${props.y}`;
  }
  if ("value" in props) return `histogram chart of ${props.value}${split}`;
  const ys = Array.isArray(props.y) ? props.y.join(", ") : props.y;
  return `${type} chart of ${ys} by ${props.x}${split}`;
}

// Series names and x values are data — they land in the tooltip HTML, so
// they must not arrive with markup intact.
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
