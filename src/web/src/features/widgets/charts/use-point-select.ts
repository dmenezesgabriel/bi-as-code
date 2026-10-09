import { useCallback, useRef } from "react";
import { clauseList, clausePoint } from "../../crossfilter/clause";
import type {
  ClauseOptions,
  QueryClient,
  SelectionClause,
} from "../../crossfilter/types";
import type { ChartClickHandler, ChartClickParams } from "./types";
import { useChartPublish } from "./use-chart-publish";

/**
 * Held-point equality: `Object.is`, except `Date` which compares by
 * instant — equal cells emit fresh `Date` objects per render, so identity
 * would never see the same point clicked twice.
 */
function sameX(a: unknown, b: unknown): boolean {
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
 * The click interactor on a `select="crossfilter"` chart (mosaic's
 * `Toggle` port): a mark click publishes `clausePoint(field, datumX)`
 * into `field`'s selection, shift/meta accumulates into `clauseList`, and
 * clicking the lone selected mark clears. Returns `undefined` when the
 * chart doesn't wire point selection — the caller attaches the handler to
 * `EChart`'s `events` only when it exists.
 */
export function usePointSelect(
  field: string | undefined,
  client: QueryClient,
): ChartClickHandler | undefined {
  const { clauseOptions, publish } = useChartPublish(client);
  const selectedRef = useRef<readonly unknown[]>([]);
  const handler = useCallback(
    (params: ChartClickParams) => {
      if (field === undefined || params.componentType !== "series") return;
      const x = datumX(params);
      if (x === null || x === undefined) return;
      const event = params.event?.event;
      const additive = Boolean(event?.shiftKey || event?.metaKey);
      const next = nextPointValues(selectedRef.current, x, additive);
      selectedRef.current = next;
      publish(pointSelectClause(field, next, clauseOptions));
    },
    [field, clauseOptions, publish],
  );
  return field === undefined ? undefined : handler;
}
