import type { ReactElement } from "react";
import type { Row } from "../../data/types";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import { collectItemChildren } from "../markdown/collect-children";
import { ColumnError, FormatError } from "../value/types";
import { Column } from "./column";
import { DataTable } from "./data-table";
import { TableError, TableLoading } from "./states";
import { resolveTableColumns } from "./table-columns";
import type { ColumnProps, TableColumn, TableProps } from "./types";

/**
 * The `<Table>` MDX widget: `data` names a ```sql fence whose registry
 * result it renders through `DataTable` — sort and pagination are local
 * transforms over the already-materialized rows, so interactions never
 * re-query. `filters` names page filters whose predicates wrap the fence's
 * query; with no filter contributing, the registry's unfiltered result
 * shows. `<Column>` children pick, order, title and format the columns;
 * without them every column shows, numbers as `num0`. A `data` that names
 * no registered block (typo, or a page with no sql fences at all), a
 * `<Column>` naming no result column, or a `fmt` its values cannot take
 * renders an inline alert instead of throwing inside MDX: one bad widget
 * must not take down the page around it.
 *
 * @example
 * <Table data="weekly_trend" />
 * <Table data="orders" pageSize={25} filters="region" />
 * <Table data="orders"><Column id="revenue" fmt="usd" title="Revenue" /></Table>
 */
export function Table({ data, pageSize = 10, filters, children }: TableProps) {
  const result = useFilteredQueryRows(data, filters);
  const specs = collectItemChildren<ColumnProps>(
    children,
    Column,
    "Column",
    "id",
  );
  if (typeof specs === "string") {
    return <TableError name={data} message={specs} />;
  }
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
  const columns = specs.map((spec) => spec.props);
  return (
    <ColumnsTable
      name={data}
      rows={result.rows}
      specs={columns}
      pageSize={pageSize}
    />
  );
}

/**
 * Resolves the `<Column>` specs against the materialized rows; a typed
 * author error (`ColumnError`, `FormatError`) renders inline, anything
 * unexpected rethrows.
 */
function ColumnsTable({
  name,
  rows,
  specs,
  pageSize,
}: {
  name: string;
  rows: readonly Row[];
  specs: readonly ColumnProps[];
  pageSize: number;
}): ReactElement {
  if (specs.length === 0) {
    return <DataTable rows={rows} downloadName={name} pageSize={pageSize} />;
  }
  let columns: TableColumn[];
  try {
    columns = resolveTableColumns(rows, specs);
  } catch (error) {
    if (error instanceof ColumnError || error instanceof FormatError) {
      return <TableError name={name} message={error.message} />;
    }
    throw error;
  }
  return (
    <DataTable
      rows={rows}
      downloadName={name}
      pageSize={pageSize}
      columns={columns}
    />
  );
}
