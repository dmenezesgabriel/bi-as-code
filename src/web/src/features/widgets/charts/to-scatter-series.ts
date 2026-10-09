import type { Row } from "../../data/types";
import {
  normalizeX,
  resolveSeriesSpec,
  seriesKey,
  seriesName,
  seriesValuesOf,
  toY,
} from "./to-series";
import type {
  ScatterModel,
  ScatterPoint,
  ScatterSeries,
  ScatterSpec,
} from "./types";

/** Per-y-column buckets: y column → series key → sparse points. */
type ScatterGroups = Map<string, Map<string, ScatterPoint[]>>;

/**
 * Pivots result rows into a sparse scatter model — the correlation-family
 * counterpart of `toSeries`. Unlike the domain-aligned series charts, each
 * point keeps only the rows its series actually has (no `[x, null]` padding
 * for other series' x positions — scatter has no stacked alignment to keep)
 * and a `size` binding rides as the point's third slot. `x`/`y`/`series`/
 * `size` name result columns (the fence owns the SQL; a miss throws
 * `ColumnError` naming the column and listing the available ones). Rows
 * with a null x are dropped — a null has no axis position; a null or
 * non-numeric y/size cell becomes `null` on the tuple.
 *
 * @example
 * toScatterSeries(rows, { x: "orders", y: "revenue", series: "region", size: "accounts" })
 * // { xDomain: [10, 20, 15], xType: "value",
 * //   series: [{ name: "North", y: "revenue", data: [[10,100,4],[20,160,6]] }, …] }
 */
export function toScatterSeries(
  rows: readonly Row[],
  spec: ScatterSpec,
): ScatterModel {
  const resolved = resolveSeriesSpec(rows, spec, "scatter");
  if (resolved === undefined) {
    return { xDomain: [], xType: "category", series: [] };
  }
  const { domain, groups } = collectPoints(
    rows,
    spec,
    resolved.ys,
    resolved.xType,
  );
  return {
    xDomain: [...domain.values()],
    xType: resolved.xType,
    series: buildSeries(resolved.ys, spec, groups),
    ...seriesValuesOf(rows, spec.series, resolved.ys),
  };
}

function collectPoints(
  rows: readonly Row[],
  spec: ScatterSpec,
  ys: readonly string[],
  xType: ScatterModel["xType"],
): { domain: Map<unknown, unknown>; groups: ScatterGroups } {
  const domain = new Map<unknown, unknown>();
  const groups: ScatterGroups = new Map();
  for (const row of rows) {
    const xValue = row[spec.x];
    if (xValue === null || xValue === undefined) continue;
    const x = normalizeX(xValue, xType);
    const key = x instanceof Date ? x.getTime() : x;
    if (!domain.has(key)) domain.set(key, x);
    const sKey = seriesKey(row, spec.series);
    const size = spec.size === undefined ? undefined : toY(row[spec.size]);
    for (const y of ys) {
      const point: ScatterPoint =
        spec.size === undefined ? [x, toY(row[y])] : [x, toY(row[y]), size];
      pushPoint(groups, y, sKey, point);
    }
  }
  return { domain, groups };
}

function pushPoint(
  groups: ScatterGroups,
  y: string,
  sKey: string,
  point: ScatterPoint,
): void {
  let bySeries = groups.get(y);
  if (bySeries === undefined) {
    bySeries = new Map();
    groups.set(y, bySeries);
  }
  let points = bySeries.get(sKey);
  if (points === undefined) {
    points = [];
    bySeries.set(sKey, points);
  }
  points.push(point);
}

/**
 * Emits one `ScatterSeries` per (y column × series value), y-major, in
 * first-appearance order — naming matches the series charts (bare `y`
 * column with no `series`, bare series value for a single `y`,
 * `"<series> - <y>"` once several `y` columns share the grouping).
 */
function buildSeries(
  ys: readonly string[],
  spec: ScatterSpec,
  groups: ScatterGroups,
): ScatterSeries[] {
  const series: ScatterSeries[] = [];
  for (const y of ys) {
    for (const [sKey, data] of groups.get(y) ?? []) {
      series.push({
        name: seriesName(sKey, y, spec.series, ys.length),
        y,
        data,
      });
    }
  }
  return series;
}
