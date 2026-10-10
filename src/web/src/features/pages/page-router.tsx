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
import type { PageSourcePort } from "../editor/types";
import { CompileErrorPage } from "./compile-error-page";
import { EditablePage } from "./editable-page";
import { MarkdownPage } from "./markdown-page";
import { NotFoundPage } from "./not-found-page";
import { PageError } from "./page-error";
import type { CompiledPageModule, ManifestPageEntry } from "./types";
import type { BiacConfig } from "virtual:biac-config";
import type { NavTree } from "virtual:biac-pages";

/**
 * Builds the SPA router from the page manifest: one code-based route per
 * manifest entry whose loader lazily imports the page's module, a shared
 * not-found page for unmatched paths, and an in-page error boundary for
 * modules that fail to load or render. A page the dev server could not
 * compile renders its compile error in the page's place — inside the editor
 * when `?edit` is on. `site` carries `biac.config.ts`
 * into chrome consumers — the title becomes the document-title fallback and
 * `nav.sidebar` gates the sidebar; `navTree` feeds the sidebar nav.
 * `pageSource` — passed only by `biac dev` — lets `?edit` open a page in the
 * source editor.
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
  pageSource?: PageSourcePort,
) {
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell
        tree={navTree}
        site={site}
        editable={pageSource !== undefined}
      />
    ),
    notFoundComponent: NotFoundPage,
  });
  const routeTree = rootRoute.addChildren(
    pages.map((entry) => pageRoute(rootRoute, entry, site, pageSource)),
  );
  // Filter inputs persist through `history.replaceState`, which the router's
  // history wrapper reports as a REPLACE navigation — and every committed
  // navigation scroll-restores to the top by default, throwing a reader who
  // picked a filter mid-page back to the top. Restoration stays on for real
  // transitions (pathname or hash changed — the hash keeps anchor scrolling)
  // and opts out when only the search string moved.
  let previousLocation: { pathname: string; hash: string } | undefined;
  return createRouter({
    routeTree,
    history,
    defaultErrorComponent: PageError,
    scrollRestoration: ({ location }) => {
      const moved =
        previousLocation === undefined ||
        location.pathname !== previousLocation.pathname ||
        location.hash !== previousLocation.hash;
      previousLocation = { pathname: location.pathname, hash: location.hash };
      return moved;
    },
  });
}

function pageRoute(
  rootRoute: AnyRootRoute,
  entry: ManifestPageEntry,
  site: BiacConfig,
  pageSource: PageSourcePort | undefined,
): AnyRoute {
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: entry.route,
    loader: () => entry.load(),
    component: function PageRoute() {
      const mod = route.useLoaderData();
      return (
        <EditablePage file={entry.file} pageSource={pageSource}>
          {"compileError" in mod ? (
            <CompileErrorPage error={mod.compileError} />
          ) : (
            <CompiledPage mod={mod} site={site} />
          )}
        </EditablePage>
      );
    },
  });
  return route;
}

type CompiledPageProps = {
  /** The compiled page module the route's loader resolved to. */
  mod: CompiledPageModule;
  site: BiacConfig;
};

function CompiledPage({ mod, site }: CompiledPageProps) {
  // The loader resolves to the compiled page module, so named exports
  // (title, sqlBlocks) reach the renderer alongside the MDX component.
  // Config-level tables merge under the page's own — a name collision
  // between the two is already a compile error, so spread order is safe.
  // Memoized: the registry effect keys on this object, and an unstable
  // identity would re-run every query on any re-render.
  const sqlTables = useMemo(
    () => ({ ...site.sqlTables, ...mod.sqlTables }),
    [site.sqlTables, mod.sqlTables],
  );
  return <MarkdownPage page={{ ...mod, sqlTables }} siteTitle={site.title} />;
}
