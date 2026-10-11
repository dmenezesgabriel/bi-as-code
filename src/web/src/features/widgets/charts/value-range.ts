import type { FormatRange } from "../value/types";
import { xKey } from "./stack";
import type { StackedMode } from "./types";

/**
 * Any chart series whose points carry x at index 0 and the plotted value at
 * index 1 — the series charts' and the scatter's tuples both fit.
 */
export interface PlottedSeries {
  readonly data: readonly (readonly unknown[])[];
}

/**
 * The span of the finite numbers in `values` — the range one axis' labels
 * are formatted against so they share a unit. `undefined` when nothing is
 * numeric (an empty result, a string domain), which callers read as "format
 * each value on its own".
 *
 * @example
 * numericRange([4800, null, 6100]) // { min: 4800, max: 6100 }
 */
export function numericRange(
  values: Iterable<unknown>,
): FormatRange | undefined {
  let range: FormatRange | undefined;
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    range = {
      min: Math.min(range?.min ?? value, value),
      max: Math.max(range?.max ?? value, value),
    };
  }
  return range;
}

/**
 * The range a value axis spans for `series`: every plotted value when the
 * series sit side by side, the per-x stack totals when `stacked` — a stacked
 * axis reaches the sum, so its ticks must scale by the sum.
 *
 * @example
 * seriesValueRange([{ data: [["W1", 2000]] }, { data: [["W1", 3000]] }], true)
 * // { min: 5000, max: 5000 }
 */
export function seriesValueRange(
  series: readonly PlottedSeries[],
  stacked?: StackedMode,
): FormatRange | undefined {
  const points = series.flatMap((s) => s.data);
  return numericRange(
    stacked ? stackTotals(points) : points.map((point) => point[1]),
  );
}

/**
 * Per-x totals with positives and negatives piled apart — echarts stacks
 * same-sign values only, so a `+5000`/`-4000` pair reaches both `5000` and
 * `-4000` rather than netting to `1000`.
 */
function stackTotals(points: readonly (readonly unknown[])[]): number[] {
  const rises = new Map<unknown, number>();
  const falls = new Map<unknown, number>();
  for (const [x, y] of points) {
    if (typeof y !== "number") continue;
    const pile = y < 0 ? falls : rises;
    pile.set(xKey(x), (pile.get(xKey(x)) ?? 0) + y);
  }
  return [...rises.values(), ...falls.values()];
}
