import { useCallback, useRef } from "react";
import type { EChartsType } from "echarts/core";
import { clauseList, clausePoint } from "../../crossfilter/clause";
import type {
  ClauseOptions,
  QueryClient,
  SelectionClause,
} from "../../crossfilter/types";
import type { ChartClickHandler, ChartClickParams } from "./types";
import { useChartPublish } from "./use-chart-publish";

/** Mosaic `Highlight`'s de-emphasis level — unselected marks hold this opacity. */
const DIM_OPACITY = 0.2;

/**
 * Held-point equality: `Object.is`, except `Date` which compares by
 * instant — equal cells emit fresh `Date` objects per render, so identity
 * would never see the same point clicked twice.
 */
export function sameX(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  return Object.is(a, b);
}

/**
 * The accumulated-selection transition, the port of mosaic `Toggle.js`'s
 * pointer handler: a shift/meta click toggles the point in or out of the
 * held list; a plain click on the lone selected point clears; any other
 * plain click replaces.
 */
export function nextPointValues(
  selected: readonly unknown[],
  x: unknown,
  additive: boolean,
): readonly unknown[] {
  if (additive && selected.length > 0) {
    const kept = selected.filter((value) => !sameX(value, x));
    if (kept.length === selected.length) return [...selected, x];
    return kept;
  }
  if (selected.length === 1 && sameX(selected[0], x)) return [];
  return [x];
}

/**
 * The clause an accumulated selection publishes: one point is a `=` point
 * clause, several an `IN` list, none a predicate-less clause — still
 * carrying `fields` so the publish seam can route it, since clearing is
 * its only job.
 */
export function pointSelectClause(
  field: string,
  values: readonly unknown[],
  options: ClauseOptions,
): SelectionClause {
  if (values.length === 1) return clausePoint(field, values[0], options);
  return clauseList(field, values.length === 0 ? undefined : values, options);
}

/** The clicked mark's x: our series and scatter data bind `[x, y, …]` tuples. */
function datumX(params: ChartClickParams): unknown {
  return Array.isArray(params.value) ? params.value[0] : params.value;
}

/**
 * The `[x, …]` tuple behind a series data item — the option emits bare
 * tuples, a re-dim meets `{value}`-wrapped ones. Non-tuple items (a
 * histogram's bare counts) return undefined and never dim.
 */
function itemTuple(item: unknown): readonly unknown[] | undefined {
  const value = Array.isArray(item)
    ? item
    : (item as { readonly value?: unknown } | null | undefined)?.value;
  return Array.isArray(value) ? value : undefined;
}

/**
 * One series' `data` under a held point selection — marks whose x isn't in
 * `values` wrap as `{value, itemStyle, label}` at the dim opacity (mosaic
 * `Highlight`'s per-mark attribute write, ours computed locally off the
 * clause the chart just published); an empty selection unwraps back to
 * bare tuples.
 *
 * @example
 * dimSeriesData([["West", 1], ["North", 2]], ["West"]);
 * // [["West", 1], {value: ["North", 2], itemStyle: {opacity: .2}, …}]
 */
export function dimSeriesData(
  data: readonly unknown[],
  values: readonly unknown[],
): unknown[] {
  return data.map((item) => {
    const tuple = itemTuple(item);
    if (tuple === undefined) return item;
    if (values.length > 0 && !values.some((v) => sameX(v, tuple[0]))) {
      return {
        value: [...tuple],
        itemStyle: { opacity: DIM_OPACITY },
        label: { opacity: DIM_OPACITY },
      };
    }
    return [...tuple];
  });
}

/**
 * Merge-setOption the dimmed data over the live chart — a merge, not the
 * prop path's `notMerge`, so the update restyles marks in place instead of
 * rebuilding the chart (which would replay entry animation and drop a held
 * brush extent). Reads the applied option's own series so it works at
 * click time and on the post-repaint restore alike.
 */
function dimSeries(instance: EChartsType, values: readonly unknown[]): void {
  const option = instance.getOption() as {
    readonly series?: readonly { readonly data?: readonly unknown[] }[];
  };
  if (!option.series?.length) return;
  instance.setOption({
    series: option.series.map((series) => ({
      data: dimSeriesData(series.data ?? [], values),
    })),
  });
}

/**
 * The click interactor on a `select="crossfilter"` chart (mosaic's
 * `Toggle` port): a mark click publishes `clausePoint(field, datumX)`
 * into `field`'s selection, shift/meta accumulates into `clauseList`, and
 * clicking the lone selected mark clears. The de-emphasis is painted by
 * `dimSeries` on publish and re-painted by `optionApplied` after any
 * `notMerge` rebuild — the same restore seam the brush rides — so a
 * foreign clause's re-query keeps the user's marks dimmed. `click` is
 * `undefined` when the chart doesn't wire point selection; `optionApplied`
 * is always safe (a no-op while nothing is held).
 */
export function usePointSelect(
  field: string | undefined,
  client: QueryClient,
): {
  click: ChartClickHandler | undefined;
  optionApplied: (instance: EChartsType) => void;
} {
  const { clauseOptions, publish } = useChartPublish(client);
  const selectedRef = useRef<readonly unknown[]>([]);
  const instanceRef = useRef<EChartsType | undefined>(undefined);
  const click = useCallback(
    (params: ChartClickParams) => {
      if (field === undefined || params.componentType !== "series") return;
      const x = datumX(params);
      if (x === null || x === undefined) return;
      const event = params.event?.event;
      const additive = Boolean(event?.shiftKey || event?.metaKey);
      const next = nextPointValues(selectedRef.current, x, additive);
      selectedRef.current = next;
      publish(pointSelectClause(field, next, clauseOptions));
      const instance = instanceRef.current;
      if (instance) dimSeries(instance, next);
    },
    [field, clauseOptions, publish],
  );
  const optionApplied = useCallback((instance: EChartsType) => {
    instanceRef.current = instance;
    const held = selectedRef.current;
    if (held.length > 0) dimSeries(instance, held);
  }, []);
  return { click: field === undefined ? undefined : click, optionApplied };
}
