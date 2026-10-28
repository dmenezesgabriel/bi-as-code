import type { FormatRange } from "../value/types";
import {
  chartChromeOption,
  describeChart,
  escapeHtml,
  gridOption,
  labelOption,
  probeFormat,
  safeFormat,
  yAxisOption,
  yOf,
  type TooltipParam,
} from "./to-option";
import type {
  ChartOption,
  ChartTokens,
  HistogramBin,
  HistogramChartProps,
  HistogramModel,
  HistogramSeries,
} from "./types";
import { binAxisTicks } from "./bin-axis-ticks";
import { axisValueRange, seriesValueRange } from "./value-range";

/**
 * Assembles the `setOption` payload for a histogram model: a value x-axis
 * spanning the bins' outer edges with round, `valueFmt`-formatted ticks,
 * one stacked `bar` series per series bucket with a bar at each bin's
 * midpoint at `barCategoryGap: 0` (echarts sizes value-axis bars by the
 * gap between points, so equal-width bins fill edge to edge — the
 * rendering of a `custom` renderItem without registering `CustomChart`),
 * an axis tooltip titling the bin range, and the shared chrome. `props`
 * feeds formats, colors and the aria description —
 * the model already carries the resolved bins.
 *
 * @example
 * toHistogramOption(toHistogram(rows, { value: "amount" }), props, tokens)
 */
export function toHistogramOption(
  model: HistogramModel,
  props: HistogramChartProps,
  tokens: ChartTokens,
): ChartOption {
  assertFormats(model, props);
  const legend = props.legend ?? model.series.length > 1;
  // Bin counts are integers — default them to `num0` on the axis, tooltip
  // and labels so a shallow histogram never labels a fractional frequency
  // (the bare `num` preset would render a count of 4 as "4.00").
  const countFmt = props.yFmt ?? "num0";
  const countRange = stackedCountRange(model.series);
  return {
    grid: gridOption(legend),
    xAxis: xAxisOption(model.bins, props),
    // Counts are whole, so the count range ticks on whole numbers.
    yAxis: yAxisOption(
      { yTitle: props.yTitle ?? "Frequency", yFmt: countFmt },
      false,
      countRange,
    ),
    series: model.series.map((s) =>
      seriesOption(s, model.bins, props, { countFmt, countRange, tokens }),
    ),
    ...chartChromeOption(props, legend),
    tooltip: {
      trigger: "axis",
      formatter: (params: TooltipParam | readonly TooltipParam[]) =>
        tooltipHtml(params, model, props, countFmt),
    },
    aria: {
      enabled: true,
      label: { description: describeChart("histogram", props) },
    },
  };
}

/**
 * Validates every fmt prop against a representative sample — a bad code
 * throws `FormatError` at option-build time, where the widget's state
 * switch renders it as the chart's error face, instead of firing inside an
 * echarts render callback. Counts are non-negative integers, so `0` probes
 * them; `valueFmt` probes the first bin edge.
 */
function assertFormats(
  model: HistogramModel,
  props: HistogramChartProps,
): void {
  probeFormat(props.valueFmt, model.bins[0]?.start ?? 0);
  probeFormat(props.yFmt, 0);
  probeFormat(props.labelsFmt, 0);
}

/**
 * The per-bin totals across every series — series always stack, so the
 * count axis reaches the total and its ticks and labels scale by it.
 */
function stackedCountRange(
  series: readonly HistogramSeries[],
): FormatRange | undefined {
  const binned = series.map((s) => ({
    data: s.counts.map((count, bin) => [bin, count]),
  }));
  return seriesValueRange(binned, true);
}

function xAxisOption(
  bins: readonly HistogramBin[],
  props: HistogramChartProps,
): Record<string, unknown> {
  const min = bins[0]?.start;
  const max = bins.at(-1)?.end;
  const ticks = binAxisTicks(min ?? 0, max ?? 0);
  // Ticks format against their own span so the axis reads in one unit —
  // `0 2k 4k`, never `2,000` beside `4k` — and whole ticks over fractional
  // edges drop the decimals they don't have (`10`, not `10.0`).
  const range = axisValueRange(ticks);
  return {
    // Ticks are round values, not bin edges: a bin width of span / count is
    // rarely round, so neighbouring edges labelled in one unit collapse to
    // the same text (`3k 3k 3k 4k`).
    type: "value",
    // Pinned to the outer edges, so the first and last bins sit flush with
    // the plot edge and no padding tick hangs past the data.
    min,
    max,
    // echarts 6 insets a value axis holding bars by half a bar each side so
    // a bar centred on the extent fits; each bin's bar already spans exactly
    // its edges inside the extent, so the inset would only pad the sides.
    containShape: false,
    ...tickOption(ticks, (value) => safeFormat(value, props.valueFmt, range)),
    ...(props.xTitle !== undefined
      ? { name: props.xTitle, nameLocation: "middle", nameGap: 30 }
      : {}),
    animation: false,
  };
}

function tickOption(
  ticks: readonly number[],
  formatter: (value: number) => string,
): Record<string, unknown> {
  const customValues = [...ticks];
  return {
    axisTick: { customValues },
    axisLabel: { customValues, formatter, hideOverlap: true },
  };
}

interface CountStyle {
  readonly countFmt: string;
  readonly countRange: FormatRange | undefined;
  readonly tokens: ChartTokens;
}

function seriesOption(
  series: HistogramSeries,
  bins: readonly HistogramBin[],
  props: HistogramChartProps,
  { countFmt, countRange, tokens }: CountStyle,
): Record<string, unknown> {
  return {
    name: series.name,
    type: "bar",
    // Series always stack — grouped bars would occlude each other over the
    // shared dense domain, and the stack preserves the total shape
    // (evidence's cumulative-offset renderItem does the same).
    stack: "total",
    barCategoryGap: 0,
    data: series.counts.map((count, i) => [binMidpoint(bins[i]), count]),
    ...(props.seriesColors?.[series.name] !== undefined
      ? { color: props.seriesColors[series.name] }
      : {}),
    ...(props.labels
      ? labelOption(
          "bar",
          { ...props, stacked: true, yFmt: countFmt },
          countRange,
          tokens,
        )
      : {}),
    emphasis: { focus: "series", blurScope: "coordinateSystem" },
  };
}

function binMidpoint(bin: HistogramBin | undefined): number | undefined {
  return bin === undefined ? undefined : (bin.start + bin.end) / 2;
}

/**
 * The axis tooltip: the bin's range as the title (via `dataIndex` into the
 * dense domain — `axisValue` only carries the start label), then one
 * `marker name: count` row per series.
 */
function tooltipHtml(
  params: TooltipParam | readonly TooltipParam[],
  model: HistogramModel,
  props: HistogramChartProps,
  countFmt: string,
): string {
  const list = Array.isArray(params) ? params : [params];
  const first = list[0];
  if (first === undefined) return "";
  const bin =
    first.dataIndex === undefined ? undefined : model.bins[first.dataIndex];
  const title =
    bin === undefined
      ? escapeHtml(safeFormat(first.axisValue, props.valueFmt))
      : escapeHtml(binRangeTitle(bin, props.valueFmt));
  const rows = list.map(
    (p) =>
      `${p.marker ?? ""} ${escapeHtml(p.seriesName)}: ${escapeHtml(safeFormat(yOf(p.value), countFmt))}`,
  );
  return `${title}<br/>${rows.join("<br/>")}`;
}

/**
 * A bin's `start – end`, both edges against the bin's own span: a tooltip
 * is an exact readout, so an unset `valueFmt` reads in full digits
 * (`6,043 – 6,300`) where the axis reads `6k` — scaled to a unit, the two
 * edges of a narrow bin round to the same text. An explicit `valueFmt`
 * applies as written.
 */
function binRangeTitle(
  bin: HistogramBin,
  valueFmt: string | undefined,
): string {
  const range = axisValueRange([bin.start, bin.end]);
  const exact = range && { ...range, unscaled: true };
  return `${safeFormat(bin.start, valueFmt, exact)} – ${safeFormat(bin.end, valueFmt, exact)}`;
}
