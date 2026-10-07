import type { FilterIds } from "../../filters/filter-ids";

/** Direction of one column sort — `desc` first, matching evidence's cycle. */
export type SortDirection = "asc" | "desc";

/**
 * Props of the `<Table>` MDX widget: `data` is the name a named ```sql
 * fence on the same page registered; `pageSize` caps visible rows before
 * the pager kicks in; `filters` names the page filters whose predicates
 * wrap the fence's query (a lone id or a list).
 */
export interface TableProps {
  readonly data: string;
  readonly pageSize?: number;
  readonly filters?: FilterIds;
}

/**
 * The table's sort state: which column and which way, or `null` when the
 * authored query order should show through.
 */
export interface Sort {
  readonly column: string;
  readonly direction: SortDirection;
}
