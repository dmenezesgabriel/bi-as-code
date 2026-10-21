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
 * is the page's validated `sql:` front-matter (table name → `data/` path);
 * `layout` is its validated layout front-matter.
 */
export interface CompiledPageModule {
  default: ComponentType<MdxPageProps>;
  frontmatter: Record<string, unknown>;
  title: string | null;
  sqlBlocks: SqlBlock[];
  sqlTables: SqlTableMap;
  layout: PageLayout;
  /** The page's front-matter `brand:` as a stylesheet; empty when it sets none. */
  brandCss: string;
  /**
   * Present when the page reads `$translations`: the translations of
   * `language`, the first declared language's when it is not one of them.
   */
  translationsFor?: (language: string | undefined) => TranslationMap;
}

/**
 * One language's translations from `translations.yaml`, key → text or
 * nested keys — mirrors `TranslationMap` in `src/engine/types.ts`.
 */
export interface TranslationMap {
  readonly [key: string]: string | TranslationMap;
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

/**
 * How wide a page's content runs: `article` keeps the reading column,
 * `full` fills the space beside the sidebar.
 */
export type PageWidth = "article" | "full";

/** A page's layout front-matter; a key the page leaves out stays absent. */
export interface PageLayout {
  page_width?: PageWidth;
  /** True puts each chart, table and big value on its own card. */
  cards?: boolean;
  /** False hides the right-rail table of contents. */
  table_of_contents?: boolean;
  /** The table of contents' heading and the name of its `nav` landmark. */
  table_of_contents_label?: string;
}

/** Table name → `data/` file path relative to the project root. */
export type SqlTableMap = Record<string, string>;

/** A changed `data/` file under `biac dev`: its served path and mtime. */
export interface DataUpdate {
  readonly path: string;
  readonly version: number;
}

/** Calls `onUpdate` for every data change until the returned unsubscribe runs. */
export type DataUpdateSubscription = (
  onUpdate: (update: DataUpdate) => void,
) => () => void;

export interface MdxPageProps {
  components?: MdxComponentMap;
  /** The language a page that reads `$translations` renders; the first declared one when absent. */
  language?: string;
}

/** MDX element overrides — tag name → component or intrinsic element. */
export type MdxComponentMap = Record<string, ElementType>;
