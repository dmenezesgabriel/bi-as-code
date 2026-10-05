/** Direction of one column sort — `desc` first, matching evidence's cycle. */
export type SortDirection = "asc" | "desc";

/**
 * The table's sort state: which column and which way, or `null` when the
 * authored query order should show through.
 */
export interface Sort {
  readonly column: string;
  readonly direction: SortDirection;
}
