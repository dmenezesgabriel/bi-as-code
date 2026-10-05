import { useMemo } from "react";
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
import type { BiacConfig } from "virtual:biac-config";
import type { NavTree } from "virtual:biac-pages";

/**
 * Builds the SPA router from the page manifest: one code-based route per
 * manifest entry whose loader lazily imports the compiled page module, a
 * shared not-found page for unmatched paths, and an in-page error boundary
 * for modules that fail to load or render. `site` carries `biac.config.ts`
 * into chrome consumers — the title becomes the document-title fallback and
 * `nav.sidebar` gates the sidebar; `navTree` feeds the sidebar nav.
 *
 * @example
 * // src/web/src/router.tsx
 * import { pages, navTree } from "virtual:biac-pages";
 * import { config } from "virtual:biac-config";
 * export const router = buildPageRouter(pages, config, navTree);
 */
export function buildPageRouter(
  pages: ManifestPageEntry[],
  site: BiacConfig,
  navTree: NavTree,
  history?: RouterHistory,
) {
  const rootRoute = createRootRoute({
    component: () => <AppShell tree={navTree} site={site} />,
    notFoundComponent: NotFoundPage,
  });
  const routeTree = rootRoute.addChildren(
    pages.map((entry) => pageRoute(rootRoute, entry, site)),
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
  site: BiacConfig,
): AnyRoute {
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: entry.route,
    loader: () => entry.load(),
    component: function PageRoute() {
      // The loader resolves to the compiled page module, so named exports
      // (title, sqlBlocks) reach the renderer alongside the MDX component.
      const mod = route.useLoaderData();
      // Config-level tables merge under the page's own — a name collision
      // between the two is already a compile error, so spread order is safe.
      // Memoized: the registry effect keys on this object, and an unstable
      // identity would re-run every query on any re-render.
      const sqlTables = useMemo(
        () => ({ ...site.sqlTables, ...mod.sqlTables }),
        [site.sqlTables, mod.sqlTables],
      );
      return (
        <MarkdownPage page={{ ...mod, sqlTables }} siteTitle={site.title} />
      );
    },
  });
  return route;
}
