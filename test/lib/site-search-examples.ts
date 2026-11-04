import { readFileSync } from "node:fs";

/** One row of the Site search page's example table. */
export interface SiteSearchExample {
  readonly query: string;
  /** The sidebar title of the page the row says ranks first. */
  readonly first: string;
}

/** Where the Site search reference page lives in the repo. */
export const SITE_SEARCH_PAGE = new URL(
  "../../docs/pages/sql/site-search.md",
  import.meta.url,
);

/**
 * The example rows of the page, `| \`query\` | Title of the first result | … |`,
 * so the unit, integration and browser tests all check the page's own claims.
 *
 * @example
 * siteSearchExamples();
 * // → [{ query: "histogramm", first: "Histogram" }, …]
 */
export function siteSearchExamples(): SiteSearchExample[] {
  const page = readFileSync(SITE_SEARCH_PAGE, "utf-8");
  const section = page.split(/^## Try it$/m)[1]?.split(/^## /m)[0] ?? "";
  return section.split("\n").flatMap((line) => {
    const [, query, first] = line.split("|").map((cell) => cell.trim());
    if (!query?.startsWith("`") || !query.endsWith("`") || !first) return [];
    return [{ query: query.slice(1, -1), first }];
  });
}
