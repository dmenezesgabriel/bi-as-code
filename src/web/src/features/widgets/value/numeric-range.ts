import type { FormatRange } from "./types";

/**
 * The span of the finite numbers in `values` — the range one axis' labels
 * or one table column's cells are formatted against so they share a unit.
 * `undefined` when nothing is numeric (an empty result, a string domain),
 * which callers read as "format each value on its own".
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
