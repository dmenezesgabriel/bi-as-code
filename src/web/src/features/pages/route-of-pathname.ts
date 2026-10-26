/**
 * The router's `trailingSlash` option: every page URL it builds is the
 * route's directory, `/<route>/` — the URL of the `<route>/index.html` the
 * build emits (ADR-0029). An index-document host (S3 website endpoints,
 * GitHub Pages, `biac serve`) answers it `200`; a slash-less URL only
 * reaches the page through a `path` → `path/` redirect, and a host without
 * one answers `404`. Test and story routers pass it too, so they build the
 * URLs production does.
 *
 * @example
 * createRouter({ routeTree, trailingSlash: PAGE_URL_TRAILING_SLASH });
 */
export const PAGE_URL_TRAILING_SLASH = "always";

/**
 * The manifest route a location pathname shows. The router writes a page's
 * URL as its directory (`/weekly-review/`, ADR-0029) while manifest routes
 * and nav hrefs carry no trailing slash, and a hand-typed `/weekly-review`
 * renders the same page — so both forms map to the one route.
 *
 * @example
 * routeOfPathname("/weekly-review/"); // → "/weekly-review"
 * routeOfPathname("/"); // → "/"
 */
export function routeOfPathname(pathname: string): string {
  if (pathname === "/" || !pathname.endsWith("/")) return pathname;
  return pathname.slice(0, -1);
}
