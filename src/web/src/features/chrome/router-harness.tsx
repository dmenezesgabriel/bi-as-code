import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { PAGE_URL_TRAILING_SLASH } from "../pages/route-of-pathname";

/**
 * Mounts `root` under an in-memory router with one stub route per entry of
 * `paths`, starting at `initialPath`, and resolves once the initial match
 * has loaded — so chrome components reading `useRouterState` see the real
 * pathname on their first render.
 *
 * @example
 * const router = await renderWithRouter(
 *   <Breadcrumbs tree={tree} />, ["/", "/nested/page"], "/nested/page",
 * );
 */
export async function renderWithRouter(
  root: ReactNode,
  paths: string[],
  initialPath: string,
) {
  const rootRoute = createRootRoute({ component: () => root });
  const routes = paths.map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
    }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    trailingSlash: PAGE_URL_TRAILING_SLASH,
  });
  render(<RouterProvider router={router} />);
  await router.load();
  return router;
}
