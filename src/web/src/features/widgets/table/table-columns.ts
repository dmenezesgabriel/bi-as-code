import type { Row } from "../../data/types";
import { formatValue, unformattedText } from "../value/format";
import { numericRange } from "../value/numeric-range";
import { ColumnError } from "../value/types";
import { formatTitle } from "./format-title";
import type { ColumnAlign, ColumnProps, TableColumn } from "./types";

/**
 * Every column of the result, in query order, titled by `formatTitle` and
 * each cell formatted by `defaultCellText`.
 *
 * @example
 * defaultTableColumns([{ region: "West", revenue: 6100 }])
 * // [{ id: "region", … }, { id: "revenue", … }]
 */
export function defaultTableColumns(rows: readonly Row[]): TableColumn[] {
  return Object.keys(rows[0] ?? {}).map((id) => ({
    id,
    title: formatTitle(id),
    format: defaultCellText,
    align: columnAlign(rows, id),
  }));
}

/**
 * The `<Column>` children's columns: only the listed ones, in listed
 * order. A `fmt` formats against the column's range over every row, not
 * the visible page, so `num`/`usd`/`pct` read in one unit down the column
 * whatever the sort or page. Throws `ColumnError` for an `id` the result
 * lacks and `FormatError` for a `fmt` its values cannot take; an empty
 * result checks nothing, since there is nothing to render.
 *
 * @example
 * resolveTableColumns(rows, [{ id: "revenue", fmt: "usd", title: "Revenue" }])
 */
export function resolveTableColumns(
  rows: readonly Row[],
  specs: readonly ColumnProps[],
): TableColumn[] {
  return specs.map((spec) => {
    const column = {
      id: spec.id,
      title: spec.title ?? formatTitle(spec.id),
      format: cellFormatter(rows, spec),
      align: columnAlign(rows, spec.id),
    };
    assertColumnRenders(rows, column);
    return column;
  });
}

/**
 * The unformatted cell: numbers render `num0` — grouped, no decimals, and
 * never unit-scaled (an unset code would auto-scale `6100` to `6k`);
 * anything else its unformatted text; null and undefined render empty.
 */
function defaultCellText(value: unknown): string {
  if (value == null) return "";
  if (isNumeric(value)) return formatValue(value, "num0");
  return unformattedText(value);
}

function isNumeric(value: unknown): value is number | bigint {
  return typeof value === "number" || typeof value === "bigint";
}

/**
 * A result column has one type, so its first non-null cell speaks for all:
 * numbers sit right, so a header and its figures share one edge.
 */
function columnAlign(rows: readonly Row[], id: string): ColumnAlign {
  return isNumeric(firstValue(rows, id)) ? "right" : "left";
}

function firstValue(rows: readonly Row[], id: string): unknown {
  return rows.find((row) => row[id] != null)?.[id];
}

function cellFormatter(
  rows: readonly Row[],
  { id, fmt }: ColumnProps,
): TableColumn["format"] {
  if (fmt === undefined) return defaultCellText;
  const range = numericRange(rows.map((row) => row[id]));
  return (value) => (value == null ? "" : formatValue(value, fmt, range));
}

/**
 * Surfaces a bad `id` or `fmt` once, before render, instead of per cell: a
 * result column has one type, so its first non-null cell speaks for all.
 */
function assertColumnRenders(rows: readonly Row[], column: TableColumn): void {
  const first = rows[0];
  if (first === undefined) return;
  if (!Object.hasOwn(first, column.id)) {
    throw new ColumnError({ column: column.id, available: Object.keys(first) });
  }
  column.format(firstValue(rows, column.id));
}
