import { useRouterState } from "@tanstack/react-router";
import type { PageChromeEntry } from "../pages/types";

/** Which pieces of app chrome the current page shows. */
export interface ShownChrome {
  sidebar: boolean;
  header: boolean;
}

/**
 * The chrome a path shows: each switch its page's front-matter sets wins,
 * the rest fall back to the project's `nav.sidebar` — the same key-by-key
 * override the page layout follows. A path no page serves (the not-found
 * page) keeps the project's chrome, so a reader can navigate away.
 *
 * @example
 * resolvePageChrome([{ route: "/embed", header: false }], "/embed", true);
 * // → { sidebar: true, header: false }
 */
export function resolvePageChrome(
  pages: readonly PageChromeEntry[],
  pathname: string,
  projectChrome: boolean,
): ShownChrome {
  const page = pages.find((entry) => entry.route === pathname);
  return {
    sidebar: page?.sidebar ?? projectChrome,
    header: page?.header ?? projectChrome,
  };
}

/**
 * `resolvePageChrome` for the page on screen. That is the router's resolved
 * location, not its pending one: while the next page's module loads, the
 * previous page still shows and keeps its own chrome, and both switch in
 * the same commit. A first load renders nothing until the page module
 * resolves, so a page that drops its chrome never shows any.
 *
 * @example
 * const chrome = usePageChrome(pages, site.nav.sidebar);
 */
export function usePageChrome(
  pages: readonly PageChromeEntry[],
  projectChrome: boolean,
): ShownChrome {
  const pathname = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  });
  return resolvePageChrome(pages, pathname, projectChrome);
}
