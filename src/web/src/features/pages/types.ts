import type { ComponentType, ElementType } from "react";
import type { Row } from "../data/types";

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
  /** Lazily imports the page's module — invoked on route match. */
  load: () => Promise<PageModule>;
}

/**
 * What a page's module resolves to: the compiled page, or — on the dev
 * server only — the reason it did not compile. A build fails on the first
 * page that does not compile, so a built site never serves the second.
 */
export type PageModule = CompiledPageModule | FailedPageModule;

/** The module the dev server serves for a page that failed to compile. */
export interface FailedPageModule {
  compileError: PageCompileError;
}

/**
 * Why a page failed to compile. `line`/`column` are 1-based positions in
 * the page file and exist only when the failure points at one.
 */
export interface PageCompileError {
  /** Page file relative to the project root, e.g. "pages/nested/page.md". */
  file: string;
  message: string;
  line?: number;
  column?: number;
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

/**
 * Per-named-query state exposed by `QueryRegistryProvider`; a block name
 * present in the map means the page registered a ` ```sql ` fence under it.
 * `message` is display-ready (a `DataError`'s `operation (detail): cause`
 * or an interpolation error naming the offending token).
 */
export type QueryResult =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "success"; readonly rows: Row[] };

/** Table name → `data/` file path relative to the project root. */
export type SqlTableMap = Record<string, string>;

export interface MdxPageProps {
  components?: MdxComponentMap;
}

/** MDX element overrides — tag name → component or intrinsic element. */
export type MdxComponentMap = Record<string, ElementType>;
