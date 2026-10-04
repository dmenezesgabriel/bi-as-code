import {
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRoute,
  type AnyRootRoute,
  type RouterHistory,
} from "@tanstack/react-router";
import { AppShell } from "../../App";
import { MarkdownPage } from "./markdown-page";
import { NotFoundPage } from "./not-found-page";
import { PageError } from "./page-error";
import type { ManifestPageEntry } from "./types";

/**
 * Builds the SPA router from the page manifest: one code-based route per
 * manifest entry whose loader lazily imports the compiled page module, a
 * shared not-found page for unmatched paths, and an in-page error boundary
 * for modules that fail to load or render.
 *
 * @example
 * // src/web/src/router.tsx
 * import { pages } from "virtual:biac-pages";
 * export const router = buildPageRouter(pages);
 */
export function buildPageRouter(
  pages: ManifestPageEntry[],
  history?: RouterHistory,
) {
  const rootRoute = createRootRoute({
    component: AppShell,
    notFoundComponent: NotFoundPage,
  });
  const routeTree = rootRoute.addChildren(
    pages.map((entry) => pageRoute(rootRoute, entry)),
  );
  return createRouter({
    routeTree,
    history,
    defaultErrorComponent: PageError,
  });
}

function pageRoute(
  rootRoute: AnyRootRoute,
  entry: ManifestPageEntry,
): AnyRoute {
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: entry.route,
    loader: () => entry.load(),
    component: function PageRoute() {
      // The loader resolves to the compiled page module, so named exports
      // (title, sqlBlocks) reach the renderer alongside the MDX component.
      return <MarkdownPage page={route.useLoaderData()} />;
    },
  });
  return route;
}
