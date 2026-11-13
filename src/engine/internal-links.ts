import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverPages } from "./discover-pages.js";
import { pageReferences } from "./page-references.js";

// A scheme (`https:`, `mailto:`), a protocol-relative `//host`, or a
// same-page `#anchor` / `?query` names no page route.
const NOT_A_ROUTE = /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?|$)/i;

/**
 * Why `href` names no page in `routes`, or `undefined` when it does or is
 * not a page link at all. A `/`-rooted href is checked on its pathname,
 * trailing slash, `#anchor` and `?query` aside. A relative href is
 * rejected: the router writes every page URL with a trailing slash
 * (ADR-0029) while a hand-typed URL may lack it, and the browser resolves
 * `x` against `/a/page/` as `/a/page/x` but against `/a/page` as `/a/x`.
 *
 * @example
 * brokenLinkReason("/gone", new Set(["/"])); // → "no page serves this route"
 * brokenLinkReason("/#top", new Set(["/"])); // → undefined
 */
export function brokenLinkReason(
  href: string,
  routes: ReadonlySet<string>,
): string | undefined {
  if (NOT_A_ROUTE.test(href)) return;
  if (!href.startsWith("/")) {
    return "relative links resolve against the URL's trailing slash; write it /-rooted, e.g. /nested/page";
  }
  return routes.has(routePath(href)) ? undefined : "no page serves this route";
}

function routePath(href: string): string {
  const { pathname } = new URL(href, "https://link.invalid");
  const path = pathname === "/" ? pathname : pathname.replace(/\/$/, "");
  try {
    return decodeURI(path);
  } catch {
    // A malformed %-escape names no route; the raw path matches none.
    return path;
  }
}

/**
 * Fails the build when any page links to a route no page serves, listing
 * every broken link as `pages/<file>:<line> → <href>` with the reason. Runs
 * in `buildStart`, before anything is written, so the failure leaves no
 * half-written build/.
 *
 * @example
 * // in pagesPlugin's buildStart, build only
 * await assertInternalLinksResolve(root);
 */
export async function assertInternalLinksResolve(
  projectRoot: string,
): Promise<void> {
  const pages = discoverPages(projectRoot);
  const routes = new Set(pages.map((page) => page.route));
  const perPage = await Promise.all(
    pages.map(({ file }) => brokenLinksOfPage(projectRoot, file, routes)),
  );
  const broken = perPage.flat();
  if (broken.length === 0) return;
  throw new Error(
    `${broken.length} broken internal link${broken.length === 1 ? "" : "s"} — each must name a page route:\n${broken.join("\n")}`,
  );
}

async function brokenLinksOfPage(
  projectRoot: string,
  file: string,
  routes: ReadonlySet<string>,
): Promise<string[]> {
  const markdown = await readFile(join(projectRoot, file), "utf8");
  const { links } = await pageReferences(markdown, file);
  return links.flatMap(({ href, line }) => {
    const reason = brokenLinkReason(href, routes);
    return reason === undefined
      ? []
      : [`  ${file}:${line} → ${href} (${reason})`];
  });
}
