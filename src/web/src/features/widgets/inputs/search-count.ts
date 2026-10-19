import type { QueryShape } from "../../crossfilter/types";
import type { FilterIds } from "../../filters/filter-ids";
import { toFilterIds } from "../../filters/filter-ids";
import { useFilteredQueryClient } from "../../filters/use-filtered-query-rows";
import type { QueryResult } from "../../pages/types";
import { useSettledChartResult } from "../charts/use-settled-chart-result";
import { formatValue } from "../value/format";

/** What `<Search>`'s count reads: `count` is unset until a result lands. */
interface SearchMatchCount {
  readonly result: QueryResult | undefined;
  readonly count: number | undefined;
  readonly pending: boolean;
}

/**
 * The filtered re-query for a match count — one `count(*)` row back, never
 * the matching rows themselves. Predicates bind `?` args (ADR-0005).
 *
 * @example
 * useFilteredQueryClient("orders", ["q"], undefined, countShape);
 */
export const countShape: QueryShape = (block, predicate) => ({
  sql: `select count(*) as match_count from (${block.sql}) where ${predicate.sql}`,
  params: [...block.params, ...predicate.params],
  errors: [],
});

/**
 * Observable Inputs' `search` result line, worded for a match.
 *
 * @example
 * formatMatchCount(140); // "140 matches"
 */
export function formatMatchCount(count: number): string {
  if (count === 0) return "No matches";
  if (count === 1) return "1 match";
  return `${formatValue(count, "num0")} matches`;
}

/**
 * How many rows of the `data` fence match the search: the fence under every
 * id in `filters` plus the search's own `id` — no owner skip, the search's
 * own clause is the point. With no clause narrowing, the registry's
 * unfiltered rows are counted as they are. The last count stays while a
 * newer re-query runs, so typing never blanks it.
 *
 * @example
 * const { count, pending } = useSearchMatchCount("order_detail", ["region"], "q");
 */
export function useSearchMatchCount(
  data: string,
  filters: FilterIds | undefined,
  id: string,
): SearchMatchCount {
  const live = useFilteredQueryClient(
    data,
    [...toFilterIds(filters), id],
    undefined,
    countShape,
  );
  const { result, filtered, pending } = useSettledChartResult(
    live.settled,
    live.filtered,
    live.pending,
  );
  if (result?.status !== "success")
    return { result, count: undefined, pending };
  const count = filtered
    ? Number(result.rows[0]?.match_count)
    : result.rows.length;
  return { result, count, pending };
}
