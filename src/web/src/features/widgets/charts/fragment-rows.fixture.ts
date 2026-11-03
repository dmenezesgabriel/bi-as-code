import type { Row } from "../../data/types";

/** One `field = ?`, `field IN (?, …)` or `field BETWEEN ? AND ?` fragment. */
const FRAGMENT = /\b(\w+) (= \?|IN \(([?, ]+)\)|BETWEEN \? AND \?)/g;

type RowTest = (row: Row) => boolean;

function holeCount(operator: string, holes: string | undefined): number {
  if (holes) return holes.split(",").length;
  return operator.startsWith("BETWEEN") ? 2 : 1;
}

function rowTest(
  field: string,
  operator: string,
  bound: readonly unknown[],
): RowTest {
  if (operator.startsWith("BETWEEN"))
    return (row) =>
      Number(row[field]) >= Number(bound[0]) &&
      Number(row[field]) <= Number(bound[1]);
  return (row) => bound.includes(row[field]);
}

/**
 * The rows of `rows` that satisfy every predicate fragment `sql` carries on
 * `field`, binding `params` to the `?` holes in order — a composed
 * `(region IN (?, ?)) AND (region = ?)` keeps only the rows both accept.
 * `undefined` when `sql` carries no fragment on `field`, so the caller can
 * fall back to its unfiltered rows.
 *
 * @example
 * rowsSatisfying("region", rows, "(region IN (?, ?)) AND (region = ?)", ["West", "North", "North"]);
 * // → the rows whose region is North
 */
export function rowsSatisfying(
  field: string,
  rows: readonly Row[],
  sql: string,
  params: readonly unknown[],
): Row[] | undefined {
  const tests: RowTest[] = [];
  let next = 0;
  for (const [, column, operator, holes] of sql.matchAll(FRAGMENT)) {
    const count = holeCount(operator!, holes);
    if (column === field)
      tests.push(rowTest(field, operator!, params.slice(next, next + count)));
    next += count;
  }
  if (tests.length === 0) return undefined;
  return rows.filter((row) => tests.every((test) => test(row)));
}
