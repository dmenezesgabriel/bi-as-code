import type { ReactElement } from "react";
import { TableError } from "./states";
import type { ColumnProps } from "./types";

/**
 * The `<Column>` MDX widget — a data carrier whose props `<Table>` reads
 * through child inspection; rendered anywhere else it reports the misuse
 * inline instead of rendering nothing.
 *
 * @example
 * <Table data="orders"><Column id="revenue" fmt="usd" title="Revenue" /></Table>
 */
export function Column(_props: ColumnProps): ReactElement {
  return (
    <TableError name="Column" message="must be a direct child of <Table>" />
  );
}
