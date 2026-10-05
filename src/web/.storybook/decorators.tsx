import { useState } from "react";
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
import type { FakeDuckDb } from "../src/features/data/fake-duckdb";
import { DataRuntimeProvider } from "../src/features/data/runtime";
import { QueryRegistryProvider } from "../src/features/pages/query-registry";
import type { SqlBlock } from "../src/features/pages/types";

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
  return (Story) => (
    <DataRuntimeProvider layer={Layer.succeed(DuckDb, fake)}>
      <QueryRegistryProvider sqlBlocks={sqlBlocks} sqlTables={{}} params={{}}>
        <Story />
      </QueryRegistryProvider>
    </DataRuntimeProvider>
  );
}
