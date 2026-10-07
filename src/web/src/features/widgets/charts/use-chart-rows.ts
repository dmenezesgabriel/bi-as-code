import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import type { FilterIds } from "../../filters/filter-ids";
import type { QueryResult } from "../../pages/types";
import { DEFAULT_CHART_HEIGHT } from "./echart";

/**
 * The lookup every chart widget shares: `data` resolves against the page's
 * query registry — filtered by the widget's declared `filters` when any
 * contributes, the plain registry result otherwise (undefined = no fence
 * declares the name — the caller's `ChartResult` renders the alert) — and
 * `height` resolves to the chart default when unset so every face sizes
 * itself to the canvas box.
 */
export function useChartRows(
  data: string,
  height?: number,
  filters?: FilterIds,
): { result: QueryResult | undefined; height: number } {
  const result = useFilteredQueryRows(data, filters);
  return { result, height: height ?? DEFAULT_CHART_HEIGHT };
}
