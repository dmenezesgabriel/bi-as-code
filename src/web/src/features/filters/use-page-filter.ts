import { useCallback, useState, useSyncExternalStore } from "react";
import type { Filter, FilterOptions } from "./filter";
import { usePageFilters } from "./page-filters-context";

/**
 * The input-widget handle on a page filter: ensures `id` exists in the
 * page's `Filters` (configure-or-create — a consumer's bare ensure never
 * erases the codec an input supplies, and vice versa) and re-renders the
 * caller whenever the value changes. Runs the ensure during render so a
 * URL-seeded or `initialValue` value is visible on the first paint.
 * `undefined` outside a `FiltersProvider` — callers degrade like
 * `usePageFilters`.
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
  return filter;
}
