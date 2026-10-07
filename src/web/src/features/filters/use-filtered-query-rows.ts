import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useQueryResults, useQuerySource } from "../pages/query-registry";
import { runBlock } from "../pages/run-block";
import type { InterpolatedQuery } from "../pages/interpolate";
import type { QueryResult } from "../pages/types";
import { useDataRuntime } from "../data/runtime";
import type { FilterIds } from "./filter-ids";
import { toFilterIds } from "./filter-ids";
import type { FilterPredicate } from "./filter";
import type { Filters } from "./filters";
import { usePageFilters } from "./page-filters-context";

/** Id-list key separator — NUL cannot appear in a filter id. */
const IDS_SEPARATOR = "\u0000";

const idsFromKey = (key: string): string[] =>
  key ? key.split(IDS_SEPARATOR) : [];

function contributingPredicates(
  filters: Filters | undefined,
  idsKey: string,
): FilterPredicate[] {
  if (!filters) return [];
  return idsFromKey(idsKey)
    .map((id) => filters.get(id)?.predicate())
    .filter((p): p is FilterPredicate => p !== undefined);
}

function wrappedQuery(
  block: InterpolatedQuery,
  predicates: FilterPredicate[],
): InterpolatedQuery {
  return {
    sql: `select * from (${block.sql}) where ${predicates
      .map((p) => p.sql)
      .join(" AND ")}`,
    params: [...block.params, ...predicates.flatMap((p) => p.params)],
    errors: [],
  };
}

/**
 * Subscribes to every named filter (ensuring it exists — "ensure exists",
 * never reset, so a URL-seeded value survives a second consumer) and returns
 * a key of the composed predicates: `""` = none contributes. `ensure` runs
 * inside the snapshot so a URL-seeded value is visible on the first render —
 * a cold load with `?region=West` never flashes unfiltered rows.
 */
function useFilterPredicateKey(
  filters: Filters | undefined,
  idsKey: string,
): string {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!filters) return () => {};
      const unsubs = idsFromKey(idsKey).map((id) =>
        filters.ensure(id).subscribe(notify),
      );
      return () => unsubs.forEach((unsub) => unsub());
    },
    [filters, idsKey],
  );
  const getSnapshot = useCallback(() => {
    if (!filters) return "";
    return contributingPredicates(filters, idsKey)
      .map((p) => `${p.sql}|${JSON.stringify(p.params)}`)
      .join("\u0001");
  }, [filters, idsKey]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * The filtered read side of the query registry: `name` is a ```sql fence on
 * the page, `filters` the page filters the widget declares — a lone id
 * (`filters="region"`) or a list (`filters={["region", "channel"]}`). When
 * any named filter holds a value, the block's interpolated SQL is wrapped as
 * `select * from (<interpolated>) where <preds>` — predicates bind `?` args,
 * never text-interpolated (ADR-0005) — and re-runs on every filter change,
 * cancelling in-flight work. When no filter contributes, the registry's own
 * unfiltered result is reused instead of issuing a second identical query.
 * Outside a `FiltersProvider` the hook degrades to the unfiltered result.
 *
 * @example
 * const result = useFilteredQueryRows(data, ["region"]);
 */
export function useFilteredQueryRows(
  name: string,
  filters: FilterIds | undefined,
): QueryResult | undefined {
  const registryResult = useQueryResults()[name];
  const { interpolated, registered } = useQuerySource();
  const pageFilters = usePageFilters();
  const runtime = useDataRuntime();
  const block = interpolated[name];
  const idsKey = toFilterIds(filters).join(IDS_SEPARATOR);
  const predicateKey = useFilterPredicateKey(pageFilters, idsKey);
  const [filteredResult, setFilteredResult] = useState<QueryResult>({
    status: "loading",
  });

  useEffect(() => {
    if (!registered || !block || block.errors.length > 0 || predicateKey === "")
      return;
    const control = new AbortController();
    setFilteredResult({ status: "loading" });
    void runBlock(
      runtime,
      registered,
      wrappedQuery(block, contributingPredicates(pageFilters, idsKey)),
      control.signal,
    ).then((result) => {
      if (!control.signal.aborted) setFilteredResult(result);
    });
    return () => control.abort();
  }, [runtime, registered, block, pageFilters, idsKey, predicateKey]);

  if (registryResult === undefined) return undefined;
  if (!pageFilters || !block || block.errors.length > 0) return registryResult;
  if (contributingPredicates(pageFilters, idsKey).length === 0) {
    return registryResult;
  }
  return filteredResult;
}
