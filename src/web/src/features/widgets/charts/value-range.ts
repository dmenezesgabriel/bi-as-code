import { numericRange } from "../value/numeric-range";
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
  const values = points.map((point) => point[1]);
  const range = numericRange(stacked ? stackTotals(points) : values);
  // A stack is whole when its segments are — totals of 0.5 + 0.5 still need
  // the 0.5 tick between them.
  return range && { ...range, whole: isWholeNumberDomain(values) };
}

/**
 * The span of `values` with its `whole` flag set — the range one value axis
 * formats its ticks against, and whether those ticks may stop at integers.
 *
 * @example
 * axisValueRange([0, 5, 25]) // { min: 0, max: 25, whole: true }
 */
export function axisValueRange(
  values: readonly unknown[],
): FormatRange | undefined {
  const range = numericRange(values);
  return range && { ...range, whole: isWholeNumberDomain(values) };
}

/**
 * Every number in `values` is an integer (a `bigint` always is) — an axis
 * over them has nothing between its whole-number ticks to show. The models
 * carry plain cell values with no column types, so the values decide.
 */
function isWholeNumberDomain(values: readonly unknown[]): boolean {
  return values.every(
    (v) => typeof v !== "number" || !Number.isFinite(v) || Number.isInteger(v),
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
