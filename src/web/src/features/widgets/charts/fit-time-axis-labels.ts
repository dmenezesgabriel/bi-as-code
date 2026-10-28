import type { EChartsType } from "echarts/core";
import { thinTimeLabels } from "./time-ticks";
import type { PlacedTimeLabel } from "./types";

/*
 * The laid-out axis, read through echarts@6.1.0 internals: the public API
 * converts a tick to its pixel x (`convertToPixel`) but cannot say what a
 * label reads or how wide it paints. `getModel()` (`lib/core/echarts.js`)
 * and the axis' `getViewLabels`/`getLabelModel().getTextRect`
 * (`lib/coord/Axis.js`, `lib/model/mixin/textStyle.js`) give the labels the
 * engine actually paints, with the font it paints them in.
 */
interface LaidOutXAxis {
  readonly type: string;
  getViewLabels(): readonly {
    readonly formattedLabel: string;
    readonly tick: { readonly value: number };
  }[];
  getLabelModel(): { getTextRect(text: string): { readonly width: number } };
}
interface ChartInternals {
  getModel(): {
    getComponent(type: "xAxis", index: 0): { axis?: LaidOutXAxis } | undefined;
  };
}

interface PinnedXAxisOption {
  readonly axisTick?: { readonly customValues?: readonly number[] };
  readonly axisLabel?: { readonly customValues?: readonly number[] };
}

/**
 * Thins a laid-out time axis' pinned labels until none touch, at the width
 * the chart has now: every label is restored first, so a chart that grew
 * gets back the labels a narrower layout dropped. The pinned ticks stay.
 * Run it after every `setOption` and `resize` — an axis with no pinned
 * ticks (a category, value or dense time axis) is left alone.
 *
 * @example
 * chart.setOption(option, { notMerge: true });
 * fitTimeAxisLabels(chart);
 */
export function fitTimeAxisLabels(chart: EChartsType): void {
  const pinned = pinnedTicks(chart);
  // A host with no box yet lays every label at one x; it fits once sized.
  if (pinned === undefined || pinned.length <= 2 || chart.getWidth() <= 0)
    return;
  if (shownTicks(chart)?.length !== pinned.length) showLabelsAt(chart, pinned);
  const kept = thinTimeLabels(placedLabels(chart));
  if (kept.length !== pinned.length) showLabelsAt(chart, kept);
}

function xAxisOption(chart: EChartsType): PinnedXAxisOption | undefined {
  const option = chart.getOption() as { xAxis?: PinnedXAxisOption[] };
  return option.xAxis?.[0];
}

/** The axis' full pinned set — its ticks, which thinning never touches. */
function pinnedTicks(chart: EChartsType): readonly number[] | undefined {
  return xAxisOption(chart)?.axisTick?.customValues;
}

function shownTicks(chart: EChartsType): readonly number[] | undefined {
  return xAxisOption(chart)?.axisLabel?.customValues;
}

function showLabelsAt(chart: EChartsType, ticks: readonly number[]): void {
  chart.setOption({ xAxis: { axisLabel: { customValues: [...ticks] } } });
}

function placedLabels(chart: EChartsType): PlacedTimeLabel[] {
  const internals = chart as unknown as ChartInternals;
  const axis = internals.getModel().getComponent("xAxis", 0)?.axis;
  if (axis?.type !== "time") return [];
  const labelModel = axis.getLabelModel();
  return axis.getViewLabels().map(({ formattedLabel, tick }) => ({
    tick: tick.value,
    x: chart.convertToPixel({ xAxisIndex: 0 }, tick.value),
    width: labelModel.getTextRect(formattedLabel).width,
  }));
}
