import type { Table, TypeMap } from "apache-arrow";
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
  return table.toArray().map((row) => row.toJSON() as Row);
}
