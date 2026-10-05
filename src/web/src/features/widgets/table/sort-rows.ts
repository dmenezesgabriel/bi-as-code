import type { Row } from "../../data/types";
import type { Sort } from "./types";

/**
 * Sorts a copy of `rows` by one column — the input array is a shared
 * `QueryResult.rows`, so it must not be mutated. Values compare per pair:
 * number/bigint numerically (relational operators, since `-` throws on a
 * number/bigint mix), `Date` temporally, everything else as strings; null
 * and undefined always sort last regardless of direction.
 *
 * Sorting is deliberately client-side over the materialized result —
 * pushing `ORDER BY`/`LIMIT` into a re-query is the cross-filter
 * coordinator's job once it exists.
 *
 * @example
 * sortRows([{ n: 2 }, { n: 1 }], { column: "n", direction: "asc" });
 * // [{ n: 1 }, { n: 2 }]
 */
export function sortRows(rows: readonly Row[], sort: Sort): Row[] {
  return [...rows].sort((a, b) =>
    compareValues(a[sort.column], b[sort.column], sort.direction),
  );
}

/**
 * Advances the 3-state header cycle — none → desc → asc → none — for
 * `column`. Clicking a different column restarts the cycle at desc.
 *
 * @example
 * nextSort(null, "orders"); // { column: "orders", direction: "desc" }
 */
export function nextSort(current: Sort | null, column: string): Sort | null {
  if (current === null || current.column !== column) {
    return { column, direction: "desc" };
  }
  if (current.direction === "desc") {
    return { column, direction: "asc" };
  }
  return null;
}

function compareValues(
  a: unknown,
  b: unknown,
  direction: Sort["direction"],
): number {
  // Nulls sort last in both directions, so this branch must stay outside
  // the direction multiply below.
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  const result = compareNonNull(a, b);
  return direction === "asc" ? result : -result;
}

function compareNonNull(a: unknown, b: unknown): number {
  const numeric =
    (typeof a === "number" || typeof a === "bigint") &&
    (typeof b === "number" || typeof b === "bigint");
  if (numeric) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  return String(a).localeCompare(String(b));
}
