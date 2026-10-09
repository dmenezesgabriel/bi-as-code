import { useEffect, useReducer, useRef, useState } from "react";
import { useQueryResults, useQuerySource } from "../pages/query-registry";
import { runBlock } from "../pages/run-block";
import type { InterpolatedQuery } from "../pages/interpolate";
import type { QueryResult } from "../pages/types";
import { useDataRuntime } from "../data/runtime";
import type { FilterIds } from "./filter-ids";
import { toFilterIds } from "./filter-ids";
import { composeAnd } from "../crossfilter/clause";
import type { Selection } from "../crossfilter/selection";
import type { FilterPredicate, QueryClient } from "../crossfilter/types";
import { usePageFilters } from "./page-filters-context";

/** Id-list key separator — NUL cannot appear in a filter id. */
const IDS_SEPARATOR = "\u0000";

const idsFromKey = (key: string): string[] =>
  key ? key.split(IDS_SEPARATOR) : [];

function wrappedQuery(
  block: InterpolatedQuery,
  predicate: FilterPredicate,
): InterpolatedQuery {
  return {
    sql: `select * from (${block.sql}) where ${predicate.sql}`,
    params: [...block.params, ...predicate.params],
    errors: [],
  };
}

/** One cleanup unsubscribing `listener` from every selection. */
function subscribeAll(
  selections: readonly Selection[],
  listener: () => void,
): () => void {
  const unsubs = selections.map((selection) => selection.subscribe(listener));
  return () => {
    for (const unsub of unsubs) unsub();
  };
}

/**
 * The filtered read side of the query registry, bridged to the page's
 * cross-filter coordinator (ADR-0004): `name` is a ```sql fence on the
 * page, `filters` the page filters the widget declares — a lone id
 * (`filters="region"`) or a list (`filters={["region", "channel"]}`).
 * The hook's `QueryClient` connects to each declared filter's `Selection`;
 * every publish re-queries the wrapped block (`select * from
 * (<interpolated>) where <preds>` — predicates bind `?` args, never
 * text-interpolated (ADR-0005)), cancelling in-flight work, and a clause
 * that names this client skips it. `owner` is the publishing input's own
 * filter id: the options/bounds query of `<Dropdown id="region" …
 * filters={["region"]}>` registers so its own pick never narrows its own
 * options (mosaic's `menu.filterBy = $cross`). When the composed predicate
 * is empty — nothing published, or everything skipped — the registry's
 * unfiltered result is reused instead of issuing a second identical query.
 * Outside a `FiltersProvider` the hook degrades to the unfiltered result.
 *
 * @example
 * const result = useFilteredQueryRows(data, ["region"]);
 * const options = useFilteredQueryRows(data, filters, id); // input's own query
 */
export function useFilteredQueryRows(
  name: string,
  filters: FilterIds | undefined,
  owner?: string,
): QueryResult | undefined {
  return useFilteredQueryClient(name, filters, owner).result;
}

/**
 * The filtered read plus the `QueryClient` the coordinator connects: the
 * consumption client a widget needs when it also publishes clauses — its
 * clauses stamp `clients: {client}` so cross-filtering skips the publisher.
 * Widgets that only read use `useFilteredQueryRows`, the same hook without
 * the client.
 *
 * @example
 * const { result, client } = useFilteredQueryClient(data, filters);
 * selection(field).update(clausePoint(field, x, { source, clients: new Set([client]) }));
 */
export function useFilteredQueryClient(
  name: string,
  filters: FilterIds | undefined,
  owner?: string,
): { result: QueryResult | undefined; client: QueryClient } {
  const registryResult = useQueryResults()[name];
  const { interpolated, registered } = useQuerySource();
  const pageFilters = usePageFilters();
  const runtime = useDataRuntime();
  const block = interpolated[name];
  const idsKey = toFilterIds(filters).join(IDS_SEPARATOR);
  // A publish that skips this client or clears its last clause never reaches
  // a client callback, so the selections themselves force the re-render that
  // re-evaluates the registry-vs-filtered choice.
  const [, forceRender] = useReducer((count: number) => count + 1, 0);
  const [filteredResult, setFilteredResult] = useState<QueryResult>({
    status: "loading",
  });

  const blockRef = useRef(block);
  useEffect(() => {
    blockRef.current = block;
  });
  const clientRef = useRef<QueryClient | undefined>(undefined);
  clientRef.current ??= {
    query: (predicate) => {
      const current = blockRef.current;
      if (!current || current.errors.length > 0) return undefined;
      return wrappedQuery(current, predicate);
    },
    queryPending: () => setFilteredResult({ status: "loading" }),
    queryResult: (rows) =>
      setFilteredResult({ status: "success", rows: [...rows] }),
    queryError: (message) => setFilteredResult({ status: "error", message }),
  };
  const client = clientRef.current;

  // `selection(id)` ensure-creates during render — the same "ensure exists"
  // rule the registry snapshot relied on — so a URL-seeded clause composes
  // into the first paint's predicate and never flashes unfiltered rows.
  const selections = pageFilters
    ? idsFromKey(idsKey).map((id) => pageFilters.selection(id))
    : [];

  useEffect(() => {
    if (!pageFilters || !block || block.errors.length > 0 || !registered) {
      return;
    }
    const selections = idsFromKey(idsKey).map((id) =>
      pageFilters.selection(id),
    );
    // Register before connect: the owner client lands in every clause's live
    // skip set first, so a URL-seeded own clause is skipped on connect.
    const unregister = owner
      ? pageFilters.ensure(owner).registerClient(client)
      : undefined;
    const unsubscribeAll = subscribeAll(selections, forceRender);
    pageFilters.coordinator.connect(client, selections, (query, signal) =>
      runBlock(runtime, registered, query, signal),
    );
    // registerClient mutates clauses' live skip sets without a publish, and
    // connect may early-return on a fully skipped predicate — no callback
    // fires either way, so re-render here to settle the registry fallback.
    forceRender();
    return () => {
      unsubscribeAll();
      unregister?.();
      pageFilters.coordinator.disconnect(client);
    };
  }, [pageFilters, idsKey, block, registered, runtime, owner, client]);

  if (registryResult === undefined) return { result: undefined, client };
  if (!pageFilters || !block || block.errors.length > 0) {
    return { result: registryResult, client };
  }
  const predicate = composeAnd(
    selections
      .map((selection) => selection.predicate(client))
      .filter((p): p is FilterPredicate => p !== undefined),
  );
  return { result: predicate ? filteredResult : registryResult, client };
}
