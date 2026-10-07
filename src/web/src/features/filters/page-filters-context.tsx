import { createContext, useContext, useState, type ReactNode } from "react";
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
 * <FiltersProvider port={browserFilterUrlPort}>
 *   <Content components={mdxComponents} />
 * </FiltersProvider>
 */
export function FiltersProvider({
  port,
  children,
}: {
  port: FilterUrlPort;
  children: ReactNode;
}) {
  const [filters] = useState(() => new Filters(port));
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
