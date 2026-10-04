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

/**
 * A named ` ```sql ` fence lifted out of a page's markdown. The name is the
 * fence's info-string meta — ` ```sql orders ` registers "orders". Execution
 * is deferred; the block is extracted so the manifest can register it.
 */
export interface SqlBlock {
  /** Query name declared in the fence info string. */
  name: string;
  /** Raw SQL text of the fence body. */
  sql: string;
}

/** Parsed YAML front-matter of a page — arbitrary author keys, title included. */
export interface PageFrontmatter {
  [key: string]: unknown;
}

/**
 * The compiled form of one page: `code` is an ESM module whose default export
 * is the MDX component and whose `frontmatter`/`title`/`sqlBlocks` named
 * exports mirror the returned fields. `title` is the front-matter title, the
 * first non-empty h1 otherwise, and null when the page is untitled.
 */
export interface CompiledPage {
  /** ESM module source for the page. */
  code: string;
  frontmatter: PageFrontmatter;
  title: string | null;
  sqlBlocks: SqlBlock[];
}
