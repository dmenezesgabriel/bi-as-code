import { useCallback, useRef } from "react";
import type { EChartsType } from "echarts/core";
import { clauseInterval, clauseList } from "../../crossfilter/clause";
import type {
  ClauseOptions,
  QueryClient,
  SelectionClause,
} from "../../crossfilter/types";
import type {
  BrushAxis,
  ChartBrushArea,
  ChartBrushEndParams,
  ChartBrushSelectedParams,
  XAxisKind,
} from "./types";
import { useChartPublish } from "./use-chart-publish";
import { sameX } from "./use-point-select";

/** Mosaic `Interval1D`'s publish guard: extents within this epsilon are one. */
const EPSILON = 1e-12;

/**
 * Held-extent equality — the port of mosaic's `closeTo` guard: numeric
 * pairs compare within the epsilon (a drag's throttled final event repeats
 * the extent `brushEnd` carries), other extents compare element-wise with
 * `sameX` (time extents hold `Date`s, category extents domain values).
 */
function sameExtent(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  if (
    a.length === 2 &&
    a.every((v) => typeof v === "number") &&
    b.every((v) => typeof v === "number")
  ) {
    return (
      Math.abs((a[0] as number) - (b[0] as number)) < EPSILON &&
      Math.abs((a[1] as number) - (b[1] as number)) < EPSILON
    );
  }
  return a.every((value, i) => sameX(value, b[i]));
}

/**
 * The clause a brush extent publishes — the port of mosaic `Interval1D`'s
 * `publish()` plus the Region-style covered-categories mapping: a cleared
 * brush (no range) emits the predicate-less clause whose only job is
 * clearing its source.
 *
 * @example
 * brushClause({kind: "value", field: "amount"}, [10, 20], options);
 * // → { predicate: {sql: "amount BETWEEN ? AND ?", params: [10, 20]}, … }
 */
export function brushClause(
  axis: BrushAxis,
  range: readonly [number, number] | undefined,
  options: ClauseOptions,
): SelectionClause {
  if (!range) return clauseList(axis.field, undefined, options);
  const [lo, hi] = range[0] <= range[1] ? range : [range[1], range[0]];
  if (axis.kind === "time") {
    return clauseInterval(axis.field, [new Date(lo), new Date(hi)], options);
  }
  if (axis.kind === "category") {
    const start = Math.max(0, Math.round(lo));
    const end = Math.min(axis.domain.length - 1, Math.round(hi));
    return clauseList(axis.field, axis.domain.slice(start, end + 1), options);
  }
  if (axis.kind === "bins") {
    const first = axis.bins[Math.max(0, Math.round(lo))];
    const last = axis.bins[Math.min(axis.bins.length - 1, Math.round(hi))];
    return clauseInterval(
      axis.field,
      first && last ? [first.start, last.end] : undefined,
      options,
    );
  }
  return clauseInterval(axis.field, [lo, hi], options);
}

/**
 * The brush axis of a series-family chart: a category x maps covered
 * indexes through the domain into a value list, a value/time x converts
 * `coordRange` directly.
 *
 * @example
 * seriesBrushAxis(model.xType, props.x, model.xDomain);
 */
export function seriesBrushAxis(
  xType: XAxisKind,
  field: string,
  domain: readonly unknown[],
): BrushAxis {
  return xType === "category"
    ? { kind: "category", field, domain }
    : { kind: xType, field };
}

/**
 * The option fragment a brush-wired chart merges into its `setOption`
 * payload — the `brush` key is what makes the component model exist (it is
 * created from option keys only), `xAxisIndex` builds the grid panel the
 * drag and `coordRange` conversion resolve against (no finder keys → the
 * brush is "global": no panels to drag in and coord-bound areas assert),
 * `brushMode: "single"` keeps one extent per gesture (mosaic's
 * Interval1D), a plain click clears the held extent (echarts' default
 * `removeOnClick: true`, matching Interval1D's click-reset), and the
 * throttle bounds the live `brushSelected` dispatch rate during the drag.
 * The brush preprocessor injects a `toolbox` key whenever `brush` is set,
 * so the fragment pins its own — `show: false` keeps the toolbox model
 * (required by the brush coupling) without rendering the brush icon group.
 */
export const BRUSH_OPTION = {
  brush: {
    xAxisIndex: "all",
    brushMode: "single",
    throttleType: "fixRate",
    throttleDelay: 150,
  },
  toolbox: { show: false, feature: {} },
} as const;

/**
 * The interval-brush interactor on a `select="crossfilter"` chart (the
 * mosaic `Interval1D` port): the drag publishes the brushed extent live —
 * throttled by `BRUSH_OPTION` — and again on release, deduped by the
 * `closeTo` guard; a brush with no areas (a plain click) clears. The
 * handlers take the chart's `BrushAxis` at event time, so the events bag
 * can bind the axis of the currently rendered model. `optionApplied` runs
 * after every `setOption`: it re-arms the `lineX` cursor (a repaint
 * rebuilds the brush model) and re-dispatches the held area so the brush
 * visual survives `notMerge` repaints — mosaic's `init()` restore. Brush
 * events emitted during that restore are echoes, not gestures: re-arming
 * flushes the rebuilt model's empty `brushSelected`, which would otherwise
 * clear the held area and its clause before the area is re-dispatched.
 *
 * @example
 * const brush = useBrushSelect(client);
 * events = { brushEnd: (params) => brush.ended(params, axis) };
 */
export function useBrushSelect(client: QueryClient): {
  selected: (params: ChartBrushSelectedParams, axis: BrushAxis) => void;
  ended: (params: ChartBrushEndParams, axis: BrushAxis) => void;
  optionApplied: (instance: EChartsType) => void;
} {
  const { clauseOptions, publish } = useChartPublish(client);
  const extentRef = useRef<unknown>(undefined);
  const areaRef = useRef<ChartBrushArea | undefined>(undefined);
  const restoringRef = useRef(false);
  const publishAreas = useCallback(
    (areas: readonly ChartBrushArea[] | undefined, axis: BrushAxis) => {
      if (restoringRef.current) return;
      const area = areas?.find(
        (candidate) => candidate.brushType === "lineX" && candidate.coordRange,
      );
      areaRef.current = area;
      const clause = brushClause(axis, area?.coordRange, clauseOptions);
      if (sameExtent(clause.value, extentRef.current)) return;
      extentRef.current = clause.value;
      publish(clause);
    },
    [clauseOptions, publish],
  );
  const selected = useCallback(
    (params: ChartBrushSelectedParams, axis: BrushAxis) =>
      publishAreas(params.batch?.[0]?.areas, axis),
    [publishAreas],
  );
  const ended = useCallback(
    (params: ChartBrushEndParams, axis: BrushAxis) =>
      publishAreas(params.areas, axis),
    [publishAreas],
  );
  const optionApplied = useCallback((instance: EChartsType) => {
    restoringRef.current = true;
    try {
      instance.dispatchAction({
        type: "takeGlobalCursor",
        key: "brush",
        brushOption: { brushType: "lineX", brushMode: "single" },
      });
      const area = areaRef.current;
      if (area) instance.dispatchAction({ type: "brush", areas: [area] });
    } finally {
      restoringRef.current = false;
    }
  }, []);
  return { selected, ended, optionApplied };
}
