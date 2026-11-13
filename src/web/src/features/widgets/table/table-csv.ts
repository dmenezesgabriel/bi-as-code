import type { Row } from "../../data/types";
import type { TableColumn } from "./types";

/** Lets Excel decode the file as UTF-8 instead of the system code page. */
const UTF8_BOM = "\ufeff";

const ROW_SEPARATOR = "\r\n";

/** A cell holding any of these must be quoted to stay one cell. */
const NEEDS_QUOTING = /[",\r\n]/;

/**
 * Serialises the rows a table shows to CSV text: a UTF-8 BOM, a header row of
 * each column's title, then one line per row in the order given. Cells carry
 * the raw value, not the display text (`6100`, not `$6.1k`), so the file can
 * be summed and re-parsed. Text is written as is — a cell that starts with
 * `=`, `+`, `-` or `@` is not neutralised, because the rows are the author's
 * own query result and prefixing would change them.
 *
 * @example
 * toCsv([{ region: "West", revenue: 6100 }], columns)
 * // "\ufeffRegion,Revenue\r\nWest,6100"
 */
export function toCsv(
  rows: readonly Row[],
  columns: readonly TableColumn[],
): string {
  const header = csvLine(columns.map((column) => column.title));
  const body = rows.map((row) => csvLine(columns.map((c) => row[c.id])));
  return UTF8_BOM + [header, ...body].join(ROW_SEPARATOR);
}

function csvLine(cells: readonly unknown[]): string {
  return cells.map(csvCell).join(",");
}

/** Raw text of one cell, quoted only when it would otherwise split. */
function csvCell(value: unknown): string {
  const text = rawText(value);
  if (!NEEDS_QUOTING.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function rawText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
