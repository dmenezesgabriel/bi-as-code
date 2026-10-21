import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { assertNotReservedSearchKey } from "./reserved-search-keys";
import type { Filter, FilterOptions } from "./filter";
import { useFilterRoster } from "./filter-roster-context";
import { usePageFilters } from "./page-filters-context";

/**
 * The input-widget handle on a page filter: ensures `id` exists in the
 * page's `Filters` (configure-or-create — a consumer's bare ensure never
 * erases the codec an input supplies, and vice versa) and re-renders the
 * caller whenever the value changes. Runs the ensure during render so a
 * URL-seeded or `initialValue` value is visible on the first paint.
 * `undefined` outside a `FiltersProvider` — callers degrade like
 * `usePageFilters`. Inside a `FilterRosterProvider` the filter is enlisted
 * in that roster for as long as the caller is mounted. Throws on a URL
 * key the app owns (`edit`, `lang`), which a page filter must not take.
 *
 * @example
 * const filter = usePageFilter<string | string[]>("region", {
 *   column: valueColumn,
 *   ...selectValueCodec,
 * });
 * filter?.value; // current selection
 */
export function usePageFilter<Value = unknown>(
  id: string,
  opts?: FilterOptions<Value>,
): Filter<Value> | undefined {
  assertNotReservedSearchKey(id);
  const filters = usePageFilters();
  // Ensure-once (the `FiltersProvider` `useState` idiom): `opts` apply on the
  // first ensure only. Re-running `configure` per render would re-decode the
  // URL param into a fresh array each pass — a new identity that notifies and
  // re-renders forever.
  const [filter] = useState(() => filters?.ensure(id, opts));
  const subscribe = useCallback(
    (notify: () => void) => filter?.subscribe(notify) ?? (() => {}),
    [filter],
  );
  const getSnapshot = useCallback(() => filter?.getSnapshot(), [filter]);
  useSyncExternalStore(subscribe, getSnapshot);
  const roster = useFilterRoster();
  useEffect(
    () => (filter && roster ? roster.enlist(filter) : undefined),
    [filter, roster],
  );
  return filter;
}
