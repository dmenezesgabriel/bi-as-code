import { useQueryResults } from "../../pages/query-registry";
import type { QueryResult } from "../../pages/types";
import { DEFAULT_CHART_HEIGHT } from "./echart";

/**
 * The lookup every chart widget shares: `data` resolves against the page's
 * query registry (undefined = no fence declares the name — the caller's
 * `ChartResult` renders the alert), and `height` resolves to the chart
 * default when unset so every face sizes itself to the canvas box.
 */
export function useChartRows(
  data: string,
  height?: number,
): { result: QueryResult | undefined; height: number } {
  const result = useQueryResults()[data];
  return { result, height: height ?? DEFAULT_CHART_HEIGHT };
}
