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
  type TooltipParam,
} from "./to-option";
import type {
  ChartOption,
  HistogramChartProps,
  HistogramModel,
  HistogramSeries,
} from "./types";
import { numericRange, seriesValueRange } from "./value-range";

/**
 * Assembles the `setOption` payload for a histogram model: a dense category
 * x-axis of `valueFmt`-edged bin labels (identical rendering to a value-x
 * `custom` renderItem for the equal-width bins we emit, without
 * registering `CustomChart`), one stacked `bar` series per series bucket at
 * `barCategoryGap: 0`, an axis tooltip titling the bin range, and the
 * shared chrome. `props` feeds formats, colors and the aria description —
 * the model already carries the resolved bins.
 *
 * @example
 * toHistogramOption(toHistogram(rows, { value: "amount" }), props)
 */
export function toHistogramOption(
  model: HistogramModel,
  props: HistogramChartProps,
): ChartOption {
  assertFormats(model, props);
  const legend = props.legend ?? model.series.length > 1;
  // Bin counts are integers — default them to `num0` on the axis, tooltip
  // and labels so a shallow histogram never labels a fractional frequency
  // (the bare `num` preset would render a count of 4 as "4.00").
  const countFmt = props.yFmt ?? "num0";
  const countRange = stackedCountRange(model.series);
  return {
    grid: gridOption(props, legend),
    xAxis: xAxisOption(model, props),
    yAxis: {
      ...yAxisOption(
        { yTitle: props.yTitle ?? "Frequency", yFmt: countFmt },
        false,
        countRange,
      ),
      // Counts are integers — pin tick granularity so a shallow histogram
      // never labels a fractional frequency.
      minInterval: 1,
    },
    series: model.series.map((s) =>
      seriesOption(s, props, countFmt, countRange),
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
  model: HistogramModel,
  props: HistogramChartProps,
): Record<string, unknown> {
  // Edges format against the bins' whole span so the axis reads in one
  // unit — `0 2k 4k`, never `2,000` beside `4k`.
  const span = numericRange([model.bins[0]?.start, model.bins.at(-1)?.end]);
  return {
    type: "category",
    // One label per bin, its `valueFmt`-formatted start edge — at ~20 bins
    // echarts' overlap thinning keeps the axis readable.
    data: model.bins.map((b) => safeFormat(b.start, props.valueFmt, span)),
    // Bars draw inside category bands; no outer padding, so the first and
    // last bins sit flush with the plot edge like a continuous axis.
    boundaryGap: false,
    axisLabel: { hideOverlap: true },
    ...(props.xTitle !== undefined
      ? { name: props.xTitle, nameLocation: "middle", nameGap: 30 }
      : {}),
    animation: false,
  };
}

function seriesOption(
  series: HistogramSeries,
  props: HistogramChartProps,
  countFmt: string,
  countRange: FormatRange | undefined,
): Record<string, unknown> {
  return {
    name: series.name,
    type: "bar",
    // Series always stack — grouped bars would occlude each other over the
    // shared dense domain, and the stack preserves the total shape
    // (evidence's cumulative-offset renderItem does the same).
    stack: "total",
    barCategoryGap: 0,
    data: [...series.counts],
    ...(props.seriesColors?.[series.name] !== undefined
      ? { color: props.seriesColors[series.name] }
      : {}),
    ...(props.labels
      ? labelOption(
          "bar",
          { ...props, stacked: true, yFmt: countFmt },
          countRange,
        )
      : {}),
    emphasis: { focus: "series", blurScope: "coordinateSystem" },
  };
}

/**
 * The axis tooltip: the bin's `valueFmt`-formatted range as the title (via
 * `dataIndex` into the dense domain — `axisValue` only carries the start
 * label), then one `marker name: count` row per series.
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
      : `${escapeHtml(safeFormat(bin.start, props.valueFmt))} – ${escapeHtml(safeFormat(bin.end, props.valueFmt))}`;
  const rows = list.map(
    (p) =>
      `${p.marker ?? ""} ${escapeHtml(p.seriesName)}: ${escapeHtml(safeFormat(p.value, countFmt))}`,
  );
  return `${title}<br/>${rows.join("<br/>")}`;
}
