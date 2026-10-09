import { renderHook, type RenderHookResult } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ClauseOptions, QueryClient } from "../../crossfilter/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { Filters } from "../../filters/filters";
import {
  FiltersProvider,
  usePageFilters,
} from "../../filters/page-filters-context";
import type { InterpolatedQuery } from "../../pages/interpolate";

/**
 * A `QueryClient` that never queries — interactor tests only need its
 * identity, the `clients` member a published clause skips.
 */
export class IdleQueryClient implements QueryClient {
  query(): InterpolatedQuery | undefined {
    return undefined;
  }
  queryPending(): void {}
  queryResult(): void {}
  queryError(): void {}
}

/** Clause options for clause builders exercised outside a mounted chart. */
export const TEST_CLAUSE_OPTIONS: ClauseOptions = {
  source: {},
  clients: new Set(),
};

function filtersWrapper({ children }: { children: ReactNode }) {
  return (
    <FiltersProvider port={new FakeFilterUrlPort("")}>
      {children}
    </FiltersProvider>
  );
}

/**
 * Renders a chart interactor hook inside a page-filters provider, exposing
 * the page's `Filters` beside the hook's return under `key`.
 *
 * @example
 * const { result } = renderInteractor("brush", () => useBrushSelect(client));
 * result.current.brush.ended(params, axis);
 */
export function renderInteractor<K extends string, T>(
  key: K,
  useInteractor: () => T,
): RenderHookResult<{ filters: Filters } & Record<K, T>, unknown> {
  return renderHook(
    () =>
      ({
        filters: usePageFilters() as Filters,
        [key]: useInteractor(),
      }) as { filters: Filters } & Record<K, T>,
    { wrapper: filtersWrapper },
  );
}
