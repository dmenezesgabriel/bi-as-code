import { useState, type ReactElement, type ReactNode } from "react";
import type { Decorator } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Layer } from "effect";
import { DuckDb } from "../src/features/data/data-service";
import { FakeDuckDb } from "../src/features/data/fake-duckdb";
import type { Row } from "../src/features/data/types";
import { DataRuntimeProvider } from "../src/features/data/runtime";
import { FakeFilterUrlPort } from "../src/features/filters/fake-url-port";
import type { FilterUrlPort } from "../src/features/filters/filter-url-port";
import { FiltersProvider } from "../src/features/filters/page-filters-context";
import { QueryRegistryProvider } from "../src/features/pages/query-registry";
import type { SqlBlock } from "../src/features/pages/types";
import { ThemeModeProvider } from "../src/features/chrome/theme-mode";
import type { ThemeMode } from "../src/features/chrome/theme";

/**
 * Mounts the story under an in-memory TanStack router with one stub route
 * per entry of `paths`, starting at `initialPath` — the component-tree
 * analogue of the unit tests' `renderWithRouter`, so components reading
 * `useRouterState` or rendering `Link` see the real pathname. The router is
 * created once per story mount (`useState` initializer): recreating it on
 * re-render would reset navigation state mid-interaction.
 *
 * @example
 * decorators: [withMemoryRouter(["/", "/nested/page"], "/nested/page")]
 */
export function withMemoryRouter(
  paths: readonly string[],
  initialPath: string,
): Decorator {
  return (Story) => {
    const [router] = useState(() => buildStubRouter(Story, paths, initialPath));
    return <RouterProvider router={router} />;
  };
}

/** One stub route per path under a root that renders the story, so links
 * and `useRouterState` see real pathnames. */
function buildStubRouter(
  Story: Parameters<Decorator>[0],
  paths: readonly string[],
  initialPath: string,
) {
  const rootRoute = createRootRoute({ component: () => <Story /> });
  const routes = paths.map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path }),
  );
  return createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

/**
 * Mounts the story behind a `FakeDuckDb` data runtime — the storybook
 * analogue of the unit tests' `Layer.succeed(DuckDb, fake)` wiring. Each
 * story gets its own fake so `rows`/`failWhen` never leak between stories.
 * Components that mount their own `QueryRegistryProvider` (a page with
 * `sqlBlocks`) need only this.
 *
 * @example
 * decorators: [withDataRuntime(new FakeDuckDb())]
 */
export function withDataRuntime(fake: FakeDuckDb): Decorator {
  return (Story) => (
    <DataRuntimeProvider layer={Layer.succeed(DuckDb, fake)}>
      <Story />
    </DataRuntimeProvider>
  );
}

/**
 * The runtime + registry tree `withQueryData` and `withFilteredData` share —
 * one owner of the provider nesting so the registry never sits above the
 * runtime it needs.
 */
function queryDataProvider(
  sqlBlocks: readonly SqlBlock[],
  fake: FakeDuckDb,
  story: ReactNode,
): ReactElement {
  return (
    <DataRuntimeProvider layer={Layer.succeed(DuckDb, fake)}>
      <QueryRegistryProvider sqlBlocks={sqlBlocks} sqlTables={{}} params={{}}>
        {story}
      </QueryRegistryProvider>
    </DataRuntimeProvider>
  );
}

/**
 * Mounts the story inside a `QueryRegistryProvider` seeded with `blocks`
 * and the `FakeDuckDb` runtime it queries through — for components that
 * read `useQueryResults()` without mounting a registry themselves
 * (`<Table>`, `SqlBlockPre`). One decorator owns the provider nesting
 * because storybook composes decorators with the last array entry
 * outermost: two separate decorators invite an order that runs the
 * registry above the runtime it needs.
 *
 * @example
 * decorators: [withQueryData([{ name: "orders", sql }], fake)]
 */
export function withQueryData(
  sqlBlocks: readonly SqlBlock[],
  fake: FakeDuckDb,
): Decorator {
  return (Story) => queryDataProvider(sqlBlocks, fake, <Story />);
}

/**
 * Mounts the story inside a page-scoped `FiltersProvider` seeded through the
 * injected `FilterUrlPort` — the storybook analogue of `markdown-page`'s
 * provider mount, for stories of the `filters` widget prop. List this
 * decorator AFTER `withQueryData` so the filters provider sits outermost,
 * the page's own nesting.
 *
 * @example
 * decorators: [withQueryData([ORDERS], fake), withPageFilters(new FakeFilterUrlPort("?region=West"))]
 */
export function withPageFilters(port: FilterUrlPort): Decorator {
  return (Story) => (
    <FiltersProvider port={port}>
      <Story />
    </FiltersProvider>
  );
}

/**
 * The filtered-state story decorator, the whole wiring in one call: a
 * `FakeDuckDb` whose wrapped queries (`where <filterId> = ?`) return
 * `filteredRows` — defaulting to `allRows` narrowed to rows whose
 * `<filterId>` cell equals `filterValue` — while every other query returns
 * `allRows`; over that, the query-data tree and then the page's
 * `FiltersProvider` seeded with `?${filterId}=${filterValue}` (the page's
 * own nesting). The story declares only `filters` and its play.
 *
 * @example
 * decorators: [withFilteredData([ORDERS], REGION_ROWS, "region", "West")]
 */
export function withFilteredData(
  sqlBlocks: readonly SqlBlock[],
  allRows: Row[],
  filterId: string,
  filterValue: string,
  filteredRows?: Row[],
): Decorator {
  const fake = FakeDuckDb.withRowsWhen(allRows, (sql) =>
    sql.includes(`where ${filterId} = ?`)
      ? (filteredRows ?? allRows.filter((row) => row[filterId] === filterValue))
      : null,
  );
  const port = new FakeFilterUrlPort(`?${filterId}=${filterValue}`);
  return (Story) => (
    <FiltersProvider port={port}>
      {queryDataProvider(sqlBlocks, fake, <Story />)}
    </FiltersProvider>
  );
}

/**
 * Feeds the resolved light/dark mode to canvas-rendered widgets (echarts)
 * that read `useThemeMode` — the storybook analogue of the provider
 * `AppShell` mounts in the real app.
 *
 * @example
 * decorators: [withThemeMode("dark")]
 */
export function withThemeMode(mode: ThemeMode): Decorator {
  return (Story) => (
    <ThemeModeProvider mode={mode}>
      <Story />
    </ThemeModeProvider>
  );
}

/**
 * A story `beforeEach` that puts `css` in `<head>` before the story renders
 * and removes it after — the storybook analogue of the brand stylesheet
 * `biac.config.ts` injects into index.html. A `<style>` rendered by a
 * decorator would land too late: `useChartTokens` reads the tokens during
 * render, before React commits it.
 *
 * @example
 * beforeEach: injectBrandStyle(":root, .light { --chart-scale: #1e40af; }")
 */
export function injectBrandStyle(css: string): () => () => void {
  return () => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  };
}
