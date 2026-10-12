import { createContext, useContext, type ReactNode } from "react";
import type { FilterRoster } from "./filter-roster";

/**
 * The roster of the nearest container that wants to know which filters its
 * inputs drive. `usePageFilter` enlists into it, so a container never reads
 * its children's props to learn their ids.
 */
const FilterRosterContext = createContext<FilterRoster | undefined>(undefined);

/**
 * @example
 * <FilterRosterProvider roster={roster}>
 *   <Dropdown id="region" data="orders" valueColumn="region" />
 * </FilterRosterProvider>
 */
export function FilterRosterProvider({
  roster,
  children,
}: {
  roster: FilterRoster;
  children: ReactNode;
}) {
  return (
    <FilterRosterContext.Provider value={roster}>
      {children}
    </FilterRosterContext.Provider>
  );
}

/** The enclosing roster, or `undefined` for an input outside any container. */
export function useFilterRoster(): FilterRoster | undefined {
  return useContext(FilterRosterContext);
}
