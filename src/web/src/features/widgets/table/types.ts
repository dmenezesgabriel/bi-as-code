/** Direction of one column sort — `desc` first, matching evidence's cycle. */
export type SortDirection = "asc" | "desc";

/**
 * Props of the `<Table>` MDX widget: `data` is the name a named ```sql
 * fence on the same page registered; `pageSize` caps visible rows before
 * the pager kicks in.
 */
export interface TableProps {
  readonly data: string;
  readonly pageSize?: number;
}

/**
 * The table's sort state: which column and which way, or `null` when the
 * authored query order should show through.
 */
export interface Sort {
  readonly column: string;
  readonly direction: SortDirection;
}
