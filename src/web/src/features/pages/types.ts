import type { ComponentType, ElementType } from "react";

/**
 * The contract of `virtual:biac-pages` and of each compiled page module,
 * mirrored web-side: the module ids are virtual, so there is no importable
 * source of truth for these shapes.
 */
export interface ManifestPageEntry {
  /** URL path the page serves — "/" for pages/index.md. */
  route: string;
  /** Page file relative to the project root, e.g. "pages/nested/page.md". */
  file: string;
  /** True when the route came from the index convention. */
  isIndex: boolean;
  /** Front-matter `title`, when the page declares one. */
  title?: string;
  /** Front-matter `sidebar_position`, when the page declares a number. */
  sidebarPosition?: number;
  /** Lazily imports the compiled page module — invoked on route match. */
  load: () => Promise<CompiledPageModule>;
}

/**
 * One compiled markdown page: `default` is the MDX component (it takes a
 * `components` prop for element overrides); `title` is the resolved page
 * title (front-matter `title`, else the first h1, else null); `sqlBlocks`
 * are the named ```sql fences extracted for the query registry; `sqlTables`
 * is the page's validated `sql:` front-matter (table name → `data/` path).
 */
export interface CompiledPageModule {
  default: ComponentType<MdxPageProps>;
  frontmatter: Record<string, unknown>;
  title: string | null;
  sqlBlocks: SqlBlock[];
  sqlTables: SqlTableMap;
}

export interface SqlBlock {
  name: string;
  sql: string;
}

/** Table name → `data/` file path relative to the project root. */
export type SqlTableMap = Record<string, string>;

export interface MdxPageProps {
  components?: MdxComponentMap;
}

/** MDX element overrides — tag name → component or intrinsic element. */
export type MdxComponentMap = Record<string, ElementType>;
