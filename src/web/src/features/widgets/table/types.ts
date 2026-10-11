import type { ReactNode } from "react";
import type { FilterIds } from "../../filters/filter-ids";

/** Direction of one column sort — `desc` first, matching evidence's cycle. */
export type SortDirection = "asc" | "desc";

/**
 * Props of the `<Table>` MDX widget: `data` is the name a named ```sql
 * fence on the same page registered; `pageSize` caps visible rows before
 * the pager kicks in; `filters` names the page filters whose predicates
 * wrap the fence's query (a lone id or a list); `<Column>` children pick,
 * order and format the columns shown — none shows every column.
 */
export interface TableProps {
  readonly data: string;
  readonly pageSize?: number;
  readonly filters?: FilterIds;
  readonly children?: ReactNode;
}

/**
 * Props of the `<Column>` data carrier `<Table>` reads: `id` names a result
 * column, `fmt` a format code (`num`/`usd`/`pct` scale against the column's
 * range), `title` the header text.
 */
export interface ColumnProps {
  readonly id: string;
  readonly fmt?: string;
  readonly title?: string;
}

/**
 * One column as `DataTable` renders it: `id` keys the row value (and the
 * sort), `title` is the header, `format` turns a raw cell into its text.
 */
export interface TableColumn {
  readonly id: string;
  readonly title: string;
  readonly format: (value: unknown) => string;
}

/**
 * The table's sort state: which column and which way, or `null` when the
 * authored query order should show through.
 */
export interface Sort {
  readonly column: string;
  readonly direction: SortDirection;
}
