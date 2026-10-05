import { useQueryResults } from "../../pages/query-registry";
import { DataTable } from "./data-table";
import { TableError, TableLoading } from "./states";
import type { TableProps } from "./types";

/**
 * The `<Table>` MDX widget: `data` names a ```sql fence whose registry
 * result it renders through `DataTable` — sort and pagination are local
 * transforms over the already-materialized rows, so interactions never
 * re-query. A `data` that names no registered block (typo, or a page with
 * no sql fences at all) renders an inline alert instead of throwing inside
 * MDX: one bad widget must not take down the page around it.
 *
 * @example
 * <Table data="weekly_trend" />
 * <Table data="orders" pageSize={25} />
 */
export function Table({ data, pageSize = 10 }: TableProps) {
  const result = useQueryResults()[data];
  if (result === undefined) {
    return (
      <TableError
        name={data}
        message="no sql fence on this page declares this name"
      />
    );
  }
  if (result.status === "loading") return <TableLoading />;
  if (result.status === "error") {
    return <TableError name={data} message={result.message} />;
  }
  return <DataTable rows={result.rows} pageSize={pageSize} />;
}
