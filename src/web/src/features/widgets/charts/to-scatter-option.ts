import type { FormatRange } from "../value/types";
import {
  cellSample,
  chartChromeOption,
  describeChart,
  escapeHtml,
  gridOption,
  labelOption,
  probeFormat,
  safeFormat,
  xAxisOption,
  xSample,
  yAxisOption,
  type TooltipParam,
} from "./to-option";
import type {
  ChartOption,
  ScatterChartProps,
  ScatterModel,
  ScatterSeries,
} from "./types";
import { seriesValueRange } from "./value-range";

/**
 * Uniform point size when no `size` column is bound (or every bound cell is
 * null) — the same 9px evidence uses, matching the line-chart marker.
 */
const BASE_SYMBOL_SIZE = 9;

/**
 * The largest `size` cell maps to a 35px symbol; smaller values scale by
 * area, not radius (`sqrt(v/max)·35` — evidence's `calculateBubbleSize`
 * math, which reads truer perceptually than a linear radius).
 */
const MAX_BUBBLE_SIZE = 35;
const MAX_BUBBLE_SIZE_SQ = MAX_BUBBLE_SIZE * MAX_BUBBLE_SIZE;

/**
 * Assembles the `setOption` payload for a scatter model: typed x-axis,
 * per-series sparse points, an item tooltip (a point is a datum, not an
 * axis bucket — the series charts' axis tooltip would list unrelated
 * series at the same x), and `size`-scaled `symbolSize`. `props.x`/`y`/
 * `series`/`size` feed only the tooltip labels and aria description — the
 * model already carries the resolved data.
 *
 * @example
 * toScatterOption(toScatterSeries(rows, { x: "orders", y: "revenue" }), props)
 */
export function toScatterOption(
  model: ScatterModel,
  props: ScatterChartProps,
): ChartOption {
  assertFormats(model, props);
  const legend = props.legend ?? model.series.length > 1;
  const maxSize = maxSizeValue(model.series);
  const yByName = new Map(model.series.map((s) => [s.name, s.y]));
  const yRange = seriesValueRange(model.series);
  return {
    grid: gridOption(props, legend),
    xAxis: xAxisOption(model, props),
    yAxis: yAxisOption(props, false, yRange),
    series: model.series.map((s) => seriesOption(s, props, maxSize, yRange)),
    ...chartChromeOption(props, legend),
    tooltip: {
      trigger: "item",
      formatter: (param: TooltipParam) => tooltipHtml(param, props, yByName),
    },
    aria: {
      enabled: true,
      label: { description: describeChart("scatter", props) },
    },
  };
}

/**
 * Validates every fmt prop against a sample of the column it formats — a
 * bad code throws `FormatError` at option-build time, where the widget's
 * state switch renders it as the chart's error face, instead of firing
 * inside an echarts render callback.
 */
function assertFormats(model: ScatterModel, props: ScatterChartProps): void {
  probeFormat(props.xFmt, xSample(model));
  probeFormat(props.yFmt, cellSample(model.series, 1));
  probeFormat(props.labelsFmt, cellSample(model.series, 1));
  probeFormat(props.sizeFmt, cellSample(model.series, 2));
}

/**
 * The largest `size` cell across every series — the scale's denominator.
 * `undefined` when `size` is unbound or every cell is null/zero, which the
 * caller reads as "use the uniform point size".
 */
function maxSizeValue(series: readonly ScatterSeries[]): number | undefined {
  let max = 0;
  for (const s of series) {
    for (const p of s.data) {
      if (typeof p[2] === "number" && p[2] > max) max = p[2];
    }
  }
  return max > 0 ? max : undefined;
}

function seriesOption(
  series: ScatterSeries,
  props: ScatterChartProps,
  maxSize: number | undefined,
  yRange: FormatRange | undefined,
): Record<string, unknown> {
  return {
    name: series.name,
    type: "scatter",
    // Copy points — echarts may reorder/mutate series data; the model
    // belongs to the caller.
    data: series.data.map((point) => [...point]),
    symbolSize:
      maxSize === undefined
        ? BASE_SYMBOL_SIZE
        : (value: readonly unknown[]) => bubbleSize(value, maxSize),
    ...(props.seriesColors?.[series.name] !== undefined
      ? { color: props.seriesColors[series.name] }
      : {}),
    ...(props.labels ? labelOption("scatter", props, yRange) : {}),
    emphasis: { focus: "series" },
  };
}

/** A null size scales to a zero-size point — evidence's `Number(v)||0` clamp. */
function bubbleSize(value: readonly unknown[], maxSize: number): number {
  const pointSize = Math.max(Number(value[2]) || 0, 0);
  return Math.sqrt((pointSize / maxSize) * MAX_BUBBLE_SIZE_SQ);
}

/**
 * The item tooltip: marker + series name, then one row per bound column
 * (`x`, the point's `y` column, `size` when bound) formatted by its fmt
 * prop. Every interpolated value is escaped — cells are data.
 */
function tooltipHtml(
  param: TooltipParam,
  props: ScatterChartProps,
  yByName: ReadonlyMap<string, string>,
): string {
  const value = Array.isArray(param.value) ? param.value : [];
  const fallback = Array.isArray(props.y) ? "y" : props.y;
  const yColumn = yByName.get(param.seriesName ?? "") ?? fallback;
  const lines = [
    `${param.marker ?? ""} ${escapeHtml(param.seriesName)}`,
    `${escapeHtml(props.x)}: ${escapeHtml(safeFormat(value[0], props.xFmt))}`,
    `${escapeHtml(yColumn)}: ${escapeHtml(safeFormat(value[1], props.yFmt))}`,
  ];
  if (props.size !== undefined) {
    lines.push(
      `${escapeHtml(props.size)}: ${escapeHtml(safeFormat(value[2], props.sizeFmt))}`,
    );
  }
  return lines.join("<br/>");
}
