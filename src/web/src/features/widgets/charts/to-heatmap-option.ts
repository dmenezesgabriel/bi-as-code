import type { FormatRange } from "../value/types";
import {
  chartChromeOption,
  describeChart,
  escapeHtml,
  gridOption,
  probeFormat,
  safeFormat,
  type TooltipParam,
} from "./to-option";
import type {
  ChartOption,
  ChartTokens,
  HeatmapChartProps,
  HeatmapModel,
} from "./types";
import { numericRange } from "../value/numeric-range";

/**
 * Assembles the `setOption` payload for a heatmap model: two category axes
 * (x on top, y inverted — the matrix reads top-down like evidence's), one
 * `heatmap` series of `[xi,yi,v]` cells, a continuous `visualMap` strip as
 * the legend, and an item tooltip naming all three columns. `tokens` supply
 * the `inRange` ramp and cell border — those colors must be baked into the
 * option, not inherited from the chart theme.
 *
 * @example
 * toHeatmapOption(toHeatmap(rows, { x: "week", y: "region", value: "orders" }), props, tokens)
 */
export function toHeatmapOption(
  model: HeatmapModel,
  props: HeatmapChartProps,
  tokens: ChartTokens,
): ChartOption {
  assertFormats(model, props);
  const legend = props.legend ?? true;
  const grid = gridOption(props, false) as { top: number; bottom: number };
  // The colour strip's ends, its ticks and the cell labels all read off one
  // scale, so they format against its span and share a unit.
  const valueSpan = numericRange([model.min, model.max]);
  return {
    grid: {
      ...grid,
      // 'all' also contains the axis name — the top-positioned x axis'
      // `xTitle` would overflow the plot edge under 'axisLabel' alone.
      outerBoundsContain: "all",
      // The visualMap strip (~10px bar + labels) lives under the plot.
      bottom: legend ? 44 : grid.bottom,
    },
    xAxis: categoryAxis(model.xDomain, props.xFmt, props.xTitle, "top"),
    yAxis: categoryAxis(
      model.yDomain,
      props.yFmt,
      props.yTitle,
      undefined,
      true,
    ),
    series: [seriesOption(model, props, tokens.border, valueSpan)],
    ...chartChromeOption(props, false),
    tooltip: {
      trigger: "item",
      formatter: (param: TooltipParam) => tooltipHtml(param, model, props),
    },
    visualMap: {
      show: legend,
      min: model.min,
      max: model.max,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemWidth: 10,
      textStyle: { fontSize: 11, color: tokens.mutedForeground },
      text: [
        safeFormat(model.max, props.valueFmt, valueSpan),
        safeFormat(model.min, props.valueFmt, valueSpan),
      ],
      formatter: (v: unknown) => safeFormat(v, props.valueFmt, valueSpan),
      inRange: { color: colorRamp(props.colorScale, tokens) },
    },
    aria: {
      enabled: true,
      label: { description: describeChart("heatmap", props) },
    },
    animation: false,
  };
}

/**
 * Validates every fmt prop against a representative cell — a bad code
 * throws `FormatError` at option-build time, where the widget's state
 * switch renders it as the chart's error face, instead of firing inside an
 * echarts render callback.
 */
function assertFormats(model: HeatmapModel, props: HeatmapChartProps): void {
  probeFormat(props.xFmt, model.xDomain[0] ?? 0);
  probeFormat(props.yFmt, model.yDomain[0] ?? 0);
  probeFormat(props.valueFmt, model.cells[0]?.[2] ?? 0);
  probeFormat(props.labelsFmt, model.cells[0]?.[2] ?? 0);
}

/**
 * One category axis of the heatmap grid: stringified labels (a numeric
 * category must not reach ECharts as a number — it would read as an
 * ordinal index, the same trap `normalizeX` guards), `xFmt`/`yFmt` applied
 * to the raw cell at format time, no axis chrome, and the translucent
 * `splitArea` banding evidence draws behind the cells.
 */
function categoryAxis(
  domain: readonly unknown[],
  fmt: string | undefined,
  title: string | undefined,
  position: "top" | undefined,
  inverse = false,
): Record<string, unknown> {
  const domainSpan = numericRange(domain);
  return {
    type: "category",
    data: domain.map((v) =>
      fmt === undefined ? String(v) : safeFormat(v, fmt, domainSpan),
    ),
    ...(position !== undefined ? { position } : {}),
    ...(inverse ? { inverse: true } : {}),
    ...(title !== undefined
      ? { name: title, nameLocation: "middle", nameGap: 30 }
      : {}),
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { interval: 0, hideOverlap: true },
    splitArea: {
      show: true,
      areaStyle: {
        color: ["rgba(250,250,250,0.1)", "rgba(200,200,200,0.1)"],
      },
    },
  };
}

function seriesOption(
  model: HeatmapModel,
  props: HeatmapChartProps,
  border: string,
  valueSpan: FormatRange | undefined,
): Record<string, unknown> {
  return {
    name: props.value,
    type: "heatmap",
    // Copy cells — echarts may reorder/mutate series data; the model belongs
    // to the caller.
    data: model.cells.map((cell) => [...cell]),
    ...(props.labels
      ? {
          label: {
            show: true,
            formatter: (p: { value?: unknown }) =>
              safeFormat(
                cellValue(p.value),
                props.labelsFmt ?? props.valueFmt,
                valueSpan,
              ),
          },
          labelLayout: { hideOverlap: true },
        }
      : {}),
    itemStyle: { borderWidth: 0.5, borderColor: border },
  };
}

/**
 * The `inRange` ramp: unset or empty → surface-to-first-accent (the "no
 * data" end blends into the page); one color → `[surface, color]`, reading
 * as a gradient anchored on the surface rather than a flat fill; two or
 * more → verbatim. Evidence's `getBackgroundAdjustedColorScale` semantics,
 * resolved against the mode's chart tokens.
 */
function colorRamp(
  scale: string | readonly string[] | undefined,
  tokens: ChartTokens,
): readonly string[] {
  const colors = scale === undefined ? [] : [scale].flat();
  const surface = tokens.background;
  if (colors.length === 0) return [surface, tokens.series[0]!];
  if (colors.length === 1) return [surface, colors[0]!];
  return colors;
}

/**
 * The item tooltip: one row per bound column — `x` and `y` resolve the
 * raw domain cell (so `xFmt`/`yFmt` see the real value, not the
 * stringified label), `value` formats through `valueFmt`. Every
 * interpolated value is escaped — cells are data.
 */
function tooltipHtml(
  param: TooltipParam,
  model: HeatmapModel,
  props: HeatmapChartProps,
): string {
  const cell = Array.isArray(param.value) ? param.value : [];
  const xCell = model.xDomain[cell[0] as number];
  const yCell = model.yDomain[cell[1] as number];
  const lines = [
    `${escapeHtml(props.x)}: ${escapeHtml(formatCell(xCell, props.xFmt))}`,
    `${escapeHtml(props.y)}: ${escapeHtml(formatCell(yCell, props.yFmt))}`,
    `${escapeHtml(props.value)}: ${escapeHtml(safeFormat(cell[2], props.valueFmt))}`,
  ];
  return lines.join("<br/>");
}

/** The raw number off a `[xi,yi,v]` tuple (cell labels' value slot). */
function cellValue(value: unknown): unknown {
  return Array.isArray(value) ? value[2] : value;
}

/**
 * A domain cell formatted by its fmt prop — falls back to the raw string
 * form when no fmt is set (a bare `num`-auto would paint `95` as `95.0`).
 */
function formatCell(value: unknown, fmt: string | undefined): string {
  if (value === null || value === undefined) return "";
  return fmt === undefined ? String(value) : safeFormat(value, fmt);
}
