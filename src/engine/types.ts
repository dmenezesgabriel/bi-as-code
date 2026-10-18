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
  /** Front-matter `title`; absent when the page declares none. */
  title?: string;
  /** Front-matter `sidebar_position`; absent when omitted or not a number. */
  sidebarPosition?: number;
}

/** One page link inside the sidebar nav tree. */
export interface NavPage {
  /** Display label: front-matter title, "Home", or the deslugified file name. */
  name: string;
  /** Route the link navigates to. */
  href: string;
}

/** A collapsible sidebar group holding every page under one first path segment. */
export interface NavDirectory {
  /** The first path segment, e.g. "nested" for pages/nested/*. */
  id: string;
  /** Deslugified segment, e.g. "Nested" / "User Guides". */
  name: string;
  pages: NavPage[];
}

/**
 * The two-level sidebar tree derived from the page manifest: root pages plus
 * one directory per first path segment. Rendered by the SPA's sidebar nav.
 */
export interface NavTree {
  rootPages: NavPage[];
  directories: NavDirectory[];
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

/**
 * How wide a page's content runs: `article` keeps the reading column,
 * `full` fills the space beside the sidebar.
 */
export type PageWidth = "article" | "full";

/**
 * A page's validated layout front-matter. A key the author left out stays
 * absent, so a project-wide default can still fill it.
 */
export interface PageLayout {
  page_width?: PageWidth;
  /** True puts each chart, table and big value on its own card. */
  cards?: boolean;
  /** False hides the right-rail table of contents. */
  table_of_contents?: boolean;
  /** The table of contents' heading and the name of its `nav` landmark. */
  table_of_contents_label?: string;
}

/** The `PageLayout` keys that are strict on/off booleans. */
export type LayoutSwitch = "cards" | "table_of_contents";

/** Parsed YAML front-matter of a page — arbitrary author keys, title included. */
export interface PageFrontmatter {
  [key: string]: unknown;
}

/**
 * The page's `sql:` front-matter after validation: table name → `data/`
 * path relative to the project root. The client registers each entry as a
 * duckdb table when the page mounts.
 */
export type SqlTableMap = Record<string, string>;

/**
 * The project-level theme default declared in `biac.config.ts`: a fixed mode
 * or `"system"` to follow `prefers-color-scheme` until the user toggles.
 */
export type BiacTheme = "light" | "dark" | "system";

/** Chrome/navigation settings from `biac.config.ts`'s optional `nav` block. */
export interface BiacNavConfig {
  /** False removes the sidebar entirely — content spans the viewport. */
  sidebar: boolean;
}

/**
 * Resolved `biac.config.ts`: every field is concrete after loading — the
 * loader substitutes defaults for anything the project omits.
 */
export interface BiacConfig {
  /** Site name: sidebar header and the document-title fallback. */
  title: string;
  theme: BiacTheme;
  nav: BiacNavConfig;
  /** Project-wide `sql:` tables — name → `data/` file path; merged with each page's own `sql:` map in the client registry. */
  sqlTables: SqlTableMap;
  /** Loader languages: the defaults with the project's `interpreters` merged over them. Engine-only — never sent to the browser. */
  interpreters: DataLoaderInterpreters;
  /** Project-wide page layout; a page's own layout front-matter overrides it key by key. */
  layout: Required<PageLayout>;
}

/**
 * The compiled form of one page: `code` is an ESM module whose default export
 * is the MDX component and whose `frontmatter`/`title`/`sqlBlocks`/`sqlTables`
 * named exports mirror the returned fields. `title` is the front-matter title, the
 * first non-empty h1 otherwise, and null when the page is untitled.
 */
export interface CompiledPage {
  /** ESM module source for the page. */
  code: string;
  frontmatter: PageFrontmatter;
  title: string | null;
  sqlBlocks: SqlBlock[];
  /** Validated `sql:` front-matter — table name → `data/` file path. */
  sqlTables: SqlTableMap;
  /** Validated layout front-matter — `page_width` and `cards` when the page sets them. */
  layout: PageLayout;
}

/**
 * Why a page failed to compile, in the shape the SPA renders in place of the
 * page. `line`/`column` are 1-based positions in the page file and exist only
 * when the failure points at one (an MDX syntax error does; a front-matter
 * rule does not).
 */
export interface PageCompileError {
  /** Page file relative to the project root, e.g. "pages/nested/page.md". */
  file: string;
  message: string;
  line?: number;
  column?: number;
}

/**
 * Data loader interpreters: a loader's last extension (`.py`) → the argv
 * it runs with, the loader's path appended. An empty argv runs the loader
 * file itself.
 */
export type DataLoaderInterpreters = Readonly<
  Record<string, readonly string[]>
>;
