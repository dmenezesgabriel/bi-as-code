import { DataType, type Table, type TypeMap } from "apache-arrow";
import type { Row } from "./types";

/**
 * Converts an Arrow table to plain row objects. `Table.toArray()` hands out
 * `ObjectRowProxy` views that stay wired to the record batches; `toJSON`
 * copies each row out so consumers never see a proxy.
 *
 * @example
 * const rows = toRows(await connection.query("select 1 as n"));
 * rows[0].n; // 1
 */
export function toRows<T extends TypeMap>(table: Table<T>): Row[] {
  const dateFields = dateFieldNames(table);
  return table.toArray().map((row) => {
    const plain = row.toJSON() as Row;
    for (const name of dateFields) plain[name] = toDate(plain[name]);
    return plain;
  });
}

/**
 * Columns whose cells Arrow reads as epoch-ms numbers: DuckDB's DATE
 * (Date32<DAY>) and TIMESTAMP (Date64 under `castTimestampToDate`, else
 * Timestamp). apache-arrow 17's getters return numbers for both, so widgets
 * would never see a `Date`. The instant is the cell's wall-clock in UTC,
 * which is why every date formatter reads dates on the UTC clock.
 */
function dateFieldNames<T extends TypeMap>(table: Table<T>): string[] {
  return table.schema.fields
    .filter(
      (field) =>
        DataType.isDate(field.type) || DataType.isTimestamp(field.type),
    )
    .map((field) => field.name);
}

function toDate(cell: unknown): unknown {
  return typeof cell === "number" ? new Date(cell) : cell;
}
