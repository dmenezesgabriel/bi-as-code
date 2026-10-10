import { useFilteredQueryClient } from "../../filters/use-filtered-query-rows";
import type { FilterIds } from "../../filters/filter-ids";
import type { QueryResult } from "../../pages/types";
import type { QueryClient, QueryShape } from "../../crossfilter/types";
import { DEFAULT_CHART_HEIGHT } from "./echart";

/**
 * The lookup every chart widget shares: `data` resolves against the page's
 * query registry — filtered by the widget's declared `filters` when any
 * contributes, the plain registry result otherwise (undefined = no fence
 * declares the name — the caller's `ChartResult` renders the alert) — and
 * `height` resolves to the chart default when unset so every face sizes
 * itself to the canvas box. `client` is the consumption `QueryClient` the
 * coordinator connects for `filters` — a chart that also publishes clauses
 * (`select="crossfilter"`) stamps it into `clause.clients` so its own
 * clause never narrows its own rows. `shape` replaces the plain filtered
 * wrap; `filtered` says the rows are its result rather than the registry's.
 */
export function useChartRows(
  data: string,
  height?: number,
  filters?: FilterIds,
  shape?: QueryShape,
): {
  result: QueryResult | undefined;
  height: number;
  client: QueryClient;
  filtered: boolean;
} {
  const { result, client, filtered } = useFilteredQueryClient(
    data,
    filters,
    undefined,
    shape,
  );
  return { result, height: height ?? DEFAULT_CHART_HEIGHT, client, filtered };
}
