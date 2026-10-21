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
  /** Front-matter `icon`; absent when omitted or outside the catalog. */
  icon?: string;
}

/** One page link inside the sidebar nav tree. */
export interface NavPage {
  /** Display label: front-matter title, "Home", or the deslugified file name. */
  name: string;
  /** Route the link navigates to. */
  href: string;
  /** Catalog icon name shown before the label; absent when the page names none. */
  icon?: string;
}

/** A collapsible sidebar group holding every page under one first path segment. */
export interface NavDirectory {
  /** The first path segment, e.g. "nested" for pages/nested/*. */
  id: string;
  /** The folder's `directories` title in `biac.config.ts`, else the deslugified segment, e.g. "Nested" / "User Guides". */
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
  /**
   * Query name declared in the fence info string, or the `/queries/<path>`
   * reference of a query file a widget's `data` names.
   */
  name: string;
  /** Raw SQL text of the fence body or the query file. */
  sql: string;
}

/**
 * The project's `queries/` directory, read by path under it
 * (`sales/totals.sql`). `read` resolves `undefined` for a file that does
 * not exist or lies outside the directory; `list` names every `.sql` file.
 */
export interface QueryFiles {
  read(name: string): Promise<string | undefined>;
  list(): Promise<string[]>;
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

/** A concrete colour mode — the class `useTheme` puts on `<html>`. */
export type ColourMode = Exclude<BiacTheme, "system">;

/** One `#rrggbb` colour per mode, lower-cased by the loader. */
export type ModeColour = Readonly<Record<ColourMode, string>>;

/** `brand.colors`: each key replaces the theme token of the same name. */
export interface BrandColours {
  /** `--primary` — filled, selected and checked controls. */
  primary?: ModeColour;
  /** `--background` — the page surface and the chart canvas. */
  background?: ModeColour;
  /** `--positive` — a good delta's text and chip. */
  positive?: ModeColour;
  /** `--negative` — a bad delta's text and chip, a red negative value. */
  negative?: ModeColour;
  /** `--field` — the surface of every input, select and toggle row. */
  field?: ModeColour;
  /** `--sidebar` — the navigation sidebar's background. */
  sidebar?: ModeColour;
}

/** A system font stack, named by its generic family — no font file is loaded. */
export type FontStack = "sans-serif" | "serif" | "mono";

/** `brand.fonts`: each key replaces one font token, in both modes. */
export interface BrandFonts {
  /** `--body-font` — running text, controls and chart text. */
  body?: FontStack;
  /** `--heading-font` — markdown headings and the sidebar's site title. */
  heading?: FontStack;
  /** `--code-font` — code fences and inline code. */
  code?: FontStack;
}

/** Per mode, a list of `#rrggbb` colours; a mode left out keeps its default. */
export type ModeColourLists = Partial<Record<ColourMode, readonly string[]>>;

/** A brand colour measured under its contrast floor against a neighbour. */
export interface ContrastShortfall {
  /** Where the failing brand colour is written, e.g. `["brand", "palette", "light", "0"]`. */
  keyPath: readonly string[];
  colour: string;
  /** The neighbour: a theme token name, or the other brand key's written path. */
  against: string;
  againstColour: string;
  ratio: number;
  floor: number;
  /** The WCAG 2.2 success criterion the floor comes from, e.g. `1.4.11`. */
  criterion: string;
  /** Every brand key the author can change to clear the floor. */
  fixes: readonly string[];
}

/** `biac.config.ts`'s optional `brand` block. */
export interface BrandTheme {
  colors: BrandColours;
  /**
   * Per mode, 1–8 series colours laid over `--chart-1`…`--chart-8` by
   * position — the defaults fill the rest, and a mode left out keeps all
   * eight.
   */
  palette: ModeColourLists;
  /**
   * Per mode, the heatmap ramp a widget without its own `colorScale` draws —
   * one colour ramps from the page surface to it, two or more are the ramp
   * as written. A mode left out keeps the default ramp.
   */
  scale: ModeColourLists;
  fonts: BrandFonts;
  /**
   * The root font size in px, 12–24, written as a percentage of the
   * browser's default so a reader's own size still scales it. Every rem —
   * text, spacing, the reading measure, corner radii — scales with it.
   * Left out, the browser's default stands.
   */
  fontSize?: number;
  /**
   * The corner radius `--radius`, `"0"` or a px or rem length up to
   * 24px / 1.5rem, as written; the sm/md/xl corner steps derive from it. A
   * rem radius scales with `fontSize`, a px one does not. Left out, 0.5rem.
   */
  radius?: string;
}

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
  /** Sidebar folder titles. Engine-only — they reach the browser inside the manifest's `navTree`. */
  directories: DirectoryTitles;
  /** Brand colours, palette, heatmap scale and fonts; colours and palette contrast-checked. Engine-only — they reach the browser as a `<style>` in index.html. */
  brand: BrandTheme;
}

/**
 * `biac.config.ts` `directories`: a first-level folder of `pages/`, keyed
 * `"pages/<folder>"`, → the title its sidebar group and breadcrumb show.
 * The URL keeps the folder name.
 */
export type DirectoryTitles = Record<string, { title: string }>;

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
  /** The page's front-matter `brand:` as a stylesheet of only the keys it sets; empty when it sets none. */
  brandCss: string;
  /** True when the page names `$translations`, so it imports `virtual:biac-translations`. */
  readsTranslations: boolean;
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

/** One translation as the page reads it: text, or a nested map of keys. */
export type TranslationValue = string | TranslationMap;

/** A language's translations, key → text or nested keys. */
export interface TranslationMap {
  [key: string]: TranslationValue;
}

/**
 * `translations.yaml` as authored: ISO 639-1 language code → its
 * translations, in file order. Every value is already a string.
 */
export type TranslationsFile = Record<string, TranslationMap>;

/**
 * Every declared language with its keys resolved: the `en` translations
 * merged under the language's own, `$t()` references expanded.
 */
export interface ResolvedTranslations {
  /** Declared languages in file order; the first is the default. */
  languages: string[];
  byLanguage: Record<string, TranslationMap>;
}

/** Whether a page's MDX names `$translations`, found while it compiles. */
export interface PageTranslationUse {
  reads: boolean;
}

/** A page's site-search front-matter after the tolerant read. */
export interface PageSearchFields {
  /** False when the page sets `index: false`. */
  indexed: boolean;
  /** `keywords` joined with ", "; "" when absent. */
  keywords: string;
}

/** One page as `virtual:biac-search` hands it to the browser's index. */
export interface SearchDocument {
  /** The page's route — what a result links to. */
  id: string;
  title: string;
  /** The page's prose, without code fences or widgets. */
  text: string;
  keywords: string;
}

/**
 * Every searchable page in each declared language, as `virtual:biac-search`
 * serves it. Without declared languages there is one set, under "".
 */
export interface SearchDocumentSets {
  /** Declared languages in file order; the first is the default. */
  languages: string[];
  byLanguage: Record<string, SearchDocument[]>;
}
