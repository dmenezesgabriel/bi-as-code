import type { Row } from "../../data/types";
import { coerceNumeric } from "./format";
import { ColumnError } from "./types";
import type { SparklinePoint } from "./types";

/**
 * Projects result rows onto sparkline points. `x`/`y` name columns — y
 * defaults to the second column (or the first on single-column rows), x to
 * the first column that isn't y (or the row's position when none is left).
 * A named column absent from the rows throws `ColumnError`; rows whose y
 * coerces non-finite are dropped rather than drawn as gaps.
 */
export function projectSparklinePoints(
  rows: readonly Row[],
  x?: string,
  y?: string,
): SparklinePoint[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0] ?? {});
  for (const named of [x, y]) {
    if (named !== undefined && !keys.includes(named)) {
      throw new ColumnError({ column: named, available: keys });
    }
  }
  const yKey =
    y ?? (x !== undefined ? keys.find((k) => k !== x) : (keys[1] ?? keys[0]));
  if (yKey === undefined) {
    throw new ColumnError({ column: "y", available: keys });
  }
  const xKey = x ?? keys.find((k) => k !== yKey) ?? null;

  const points: SparklinePoint[] = [];
  rows.forEach((row, index) => {
    const yValue = coerceNumeric(row[yKey]);
    if (yValue === null || !Number.isFinite(Number(yValue))) return;
    points.push({ x: xKey === null ? index : row[xKey], y: Number(yValue) });
  });
  return points;
}

/**
 * The svg's accessible name when `label` is unset: `"revenue by week"` when
 * both axes are authored, else the query name — it at least identifies the
 * series.
 */
export function sparklineLabel(data: string, x?: string, y?: string): string {
  return x !== undefined && y !== undefined ? `${y} by ${x}` : data;
}

/**
 * The y domain: data min/max plus a 1% pad — data-anchored, never
 * zero-anchored, because a KPI sparkline's job is showing movement and a
 * far-from-zero series on a 0 anchor flattens to a line (the same call
 * streamlit's metric chart makes with `zero: false`). A flat series pads
 * symmetrically so its line lands mid-height.
 */
export function sparklineDomain(
  ys: readonly number[],
): readonly [number, number] {
  if (ys.length === 0) return [0, 0];
  const [min, max] = extent(ys);
  const span = max - min;
  const pad = span === 0 ? Math.max(Math.abs(min) * 0.05, 0.5) : span * 0.01;
  return [min - pad, max + pad];
}

/**
 * The fill/bar anchor: zero only when the series crosses it, else the data
 * minimum so a one-sided series fills from the domain bottom — streamlit's
 * `getAreaChartBaseline` semantics.
 */
export function sparklineBaseline(ys: readonly number[]): number {
  if (ys.length === 0) return 0;
  const [min, max] = extent(ys);
  return min < 0 && max > 0 ? 0 : min;
}

function extent(ys: readonly number[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const y of ys) {
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return [min, max];
}
