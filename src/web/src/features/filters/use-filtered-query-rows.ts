import { useEffect, useReducer, useRef, useState } from "react";
import { useQueryResults, useQuerySource } from "../pages/query-registry";
import { runBlock } from "../pages/run-block";
import type { QueryResult } from "../pages/types";
import { useDataRuntime } from "../data/runtime";
import type { FilterIds } from "./filter-ids";
import { toFilterIds } from "./filter-ids";
import { composeAnd } from "../crossfilter/clause";
import type { Selection } from "../crossfilter/selection";
import type {
  FilterPredicate,
  QueryClient,
  QueryShape,
} from "../crossfilter/types";
import { usePageFilters } from "./page-filters-context";

/** Id-list key separator — NUL cannot appear in a filter id. */
const IDS_SEPARATOR = "\u0000";
const LOADING: QueryResult = { status: "loading" };

/** What a filtered consumer reads: see `useFilteredQueryClient`. */
interface FilteredQueryRead {
  result: QueryResult | undefined;
  settled: QueryResult | undefined;
  pending: boolean;
  client: QueryClient;
  filtered: boolean;
}

const idsFromKey = (key: string): string[] =>
  key ? key.split(IDS_SEPARATOR) : [];

const wrappedQuery: QueryShape = (block, predicate) => {
  return {
    sql: `select * from (${block.sql}) where ${predicate.sql}`,
    params: [...block.params, ...predicate.params],
    errors: [],
  };
};

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
 * text-interpolated (ADR-0005)) — a publish arriving mid-query waits for it
 * and only the latest one runs — and a clause
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
 * the client. `shape` replaces the plain wrap for coordinator re-queries
 * (read through a ref: a fresh closure per render never reconnects), and
 * `filtered` says which rows came back — the shaped re-query's (`true`) or
 * the registry's unfiltered fence rows (`false`). `result` reads `loading`
 * while a re-query is in flight; `settled` is the last result that landed
 * and `pending` says a newer one is on its way — kept apart because the
 * coordinator delivers a queued publish in the task the previous query
 * settles in, so a result and the next `queryPending` render together and a
 * single state would lose the result to `loading`.
 *
 * @example
 * const { result, client } = useFilteredQueryClient(data, filters);
 * const { result, filtered } = useFilteredQueryClient(data, filters, undefined, binCounts);
 * selection(field).update(clausePoint(field, x, { source, clients: new Set([client]) }));
 */
export function useFilteredQueryClient(
  name: string,
  filters: FilterIds | undefined,
  owner?: string,
  shape: QueryShape = wrappedQuery,
): FilteredQueryRead {
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
  const [filteredResult, setFilteredResult] = useState<QueryResult>(LOADING);
  const [pending, setPending] = useState(false);

  const blockRef = useRef(block);
  const shapeRef = useRef(shape);
  useEffect(() => {
    blockRef.current = block;
    shapeRef.current = shape;
  });
  const clientRef = useRef<QueryClient | undefined>(undefined);
  clientRef.current ??= {
    query: (predicate) => {
      const current = blockRef.current;
      if (!current || current.errors.length > 0) return undefined;
      return shapeRef.current(current, predicate);
    },
    queryPending: () => setPending(true),
    queryResult: (rows) => {
      setFilteredResult({ status: "success", rows: [...rows] });
      setPending(false);
    },
    queryError: (message) => {
      setFilteredResult({ status: "error", message });
      setPending(false);
    },
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
      runBlock(runtime, registered, name, query, signal),
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
  }, [pageFilters, idsKey, block, name, registered, runtime, owner, client]);

  const unfiltered = unfilteredRead(registryResult, client);
  if (!pageFilters || !block || block.errors.length > 0) return unfiltered;
  const predicate = composeAnd(
    selections
      .map((selection) => selection.predicate(client))
      .filter((p): p is FilterPredicate => p !== undefined),
  );
  // React's "adjust state while rendering" pattern: once no clause narrows,
  // the filtered result is forgotten, so a later clause never resurfaces
  // rows an earlier one narrowed to while it re-queries.
  if (!predicate && filteredResult !== LOADING) setFilteredResult(LOADING);
  if (!predicate || registryResult === undefined) return unfiltered;
  return {
    result: pending ? LOADING : filteredResult,
    settled: filteredResult,
    pending,
    client,
    filtered: true,
  };
}

/** The registry's own result — never pending: the coordinator never ran it. */
function unfilteredRead(
  result: QueryResult | undefined,
  client: QueryClient,
): FilteredQueryRead {
  return { result, settled: result, pending: false, client, filtered: false };
}
