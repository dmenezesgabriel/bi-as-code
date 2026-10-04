/**
 * One markdown page mapped to the route it serves. The manifest built from
 * these entries is the single source of truth for the router and, later, nav.
 */
export interface PageManifestEntry {
  /** URL path the page serves — "/" for pages/index.md, "/nested" for pages/nested/index.md. */
  route: string;
  /** Page file as a posix path relative to the project root, e.g. "pages/nested/page.md". */
  file: string;
  /** True when the route came from the index convention (file named index.md or index.mdx). */
  isIndex: boolean;
}
