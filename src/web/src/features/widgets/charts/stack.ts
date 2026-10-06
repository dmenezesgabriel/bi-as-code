import type { ChartSeries, SeriesPoint } from "./types";

/**
 * The `"100%"` half of the `stacked` prop — ECharts has no percent stacking,
 * so each `[x, y]` becomes `[x, y / total, y]`: the fraction the stack
 * draws, with the raw value carried in the third slot for the tooltip.
 * Totals are per x across all series; a zero-or-negative total (all-null or
 * self-cancelling) emits 0 rather than NaN, and a null y stays a null gap —
 * normalizing must never invent a value. The plain-`true` stack needs no
 * transform (`stack` on the option does it), so it never reaches here.
 *
 * @example
 * toPercentageStack([{ name: "a", data: [[1, 30]] }, { name: "b", data: [[1, 70]] }])
 * // [{ name: "a", data: [[1, 0.3, 30]] }, { name: "b", data: [[1, 0.7, 70]] }]
 */
export function toPercentageStack(
  series: readonly ChartSeries[],
): ChartSeries[] {
  const totals = new Map<unknown, number>();
  for (const s of series) {
    for (const [x, y] of s.data) {
      if (y === null) continue;
      const key = xKey(x);
      totals.set(key, (totals.get(key) ?? 0) + y);
    }
  }
  return series.map((s) => ({
    ...s,
    data: s.data.map((point) => normalizePoint(point, totals)),
  }));
}

function normalizePoint(
  [x, y]: SeriesPoint,
  totals: ReadonlyMap<unknown, number>,
): SeriesPoint {
  if (y === null) return [x, null, null];
  const total = totals.get(xKey(x)) ?? 0;
  return [x, total > 0 ? y / total : 0, y];
}

/**
 * Totals key by instant for `Date` x (series may carry distinct instances
 * of the same instant) and by value for everything else.
 */
function xKey(x: unknown): unknown {
  return x instanceof Date ? x.getTime() : x;
}
