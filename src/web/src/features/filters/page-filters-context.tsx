import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";
import type { FilterUrlPort } from "./filter-url-port";
import { Filters } from "./filters";

/**
 * Page-scoped filter collection: one `Filters` instance per provider mount,
 * seeded from the URL at construction. Remounting on navigation re-seeds —
 * filters are page-local, as in evidence. The port is the only browser
 * boundary; tests inject `FakeFilterUrlPort`.
 */
const PageFiltersContext = createContext<Filters | undefined>(undefined);

/**
 * @example
 * <FiltersProvider port={browserFilterUrlPort} onHeldParamsChange={setHeld}>
 *   <Content components={mdxComponents} />
 * </FiltersProvider>
 */
export function FiltersProvider({
  port,
  onHeldParamsChange,
  children,
}: {
  port: FilterUrlPort;
  /** Called with `Filters.heldParams()` whenever it changes, for `{{params.*}}`. */
  onHeldParamsChange?: (params: Readonly<Record<string, unknown>>) => void;
  children: ReactNode;
}) {
  const [filters] = useState(() => new Filters(port));
  useHeldParamsReport(filters, onHeldParamsChange);
  return (
    <PageFiltersContext.Provider value={filters}>
      {children}
    </PageFiltersContext.Provider>
  );
}

/** The page's filters, or `undefined` outside a provider — callers degrade to unfiltered. */
export function usePageFilters(): Filters | undefined {
  return useContext(PageFiltersContext);
}

/**
 * Reports `filters.heldParams()` out of the provider. The first read runs
 * after the commit, so values the inputs seeded while rendering are in it
 * — a report from inside a child's render would update another component
 * mid-render. An unchanged serialization stays quiet, so a consumer that
 * re-interpolates on a new object never churns; nothing held reports
 * nothing, matching the consumer's empty start.
 */
function useHeldParamsReport(
  filters: Filters,
  onChange: ((params: Readonly<Record<string, unknown>>) => void) | undefined,
) {
  const emit = useEffectEvent((params: Readonly<Record<string, unknown>>) =>
    onChange?.(params),
  );
  useEffect(() => {
    let lastKey = "{}";
    const report = () => {
      const params = filters.heldParams();
      const key = JSON.stringify(params);
      if (key === lastKey) return;
      lastKey = key;
      emit(params);
    };
    report();
    return filters.subscribe(report);
  }, [filters]);
}
