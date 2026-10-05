import type { Row } from "../../data/types";
import { ColumnError } from "./types";

/**
 * Picks one cell out of a materialized result: `row` is the index into the
 * rows, `column` the key — defaulting to the row's first key, the common
 * case for a 1-row aggregate fence. A `column` that names no key throws
 * `ColumnError` (the widget renders it inline, naming what IS available);
 * a missing row — empty result, or an index past the end — yields
 * `undefined`, which `formatValue` renders as `–`: a param-driven empty
 * result is not an author error.
 *
 * @example
 * cellAt(rows, 0, "revenue") // rows[0].revenue, or ColumnError
 * cellAt(rows, 0)            // rows[0][first key]
 */
export function cellAt(
  rows: readonly Row[],
  row: number,
  column?: string,
): unknown {
  const target = rows[row];
  if (target === undefined) return undefined;
  const keys = Object.keys(target);
  const key = column ?? keys[0];
  if (key === undefined) return undefined;
  if (!Object.hasOwn(target, key)) {
    throw new ColumnError({ column: key, available: keys });
  }
  return target[key];
}
