import { compile } from "@mdx-js/mdx";
import type { Code, Heading, Root } from "mdast";
import { toString as toPlainText } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { NO_BRAND } from "./brand-config.js";
import { brandCss } from "./brand-css.js";
import { pageBrand } from "./page-brand-frontmatter.js";
import { assertPageChrome } from "./page-chrome-frontmatter.js";
import { pageFrontmatter, positionedPageFile } from "./page-frontmatter.js";
import { assertPageIcon } from "./page-icon-frontmatter.js";
import { pageLayout } from "./page-layout-frontmatter.js";
import { assertPageSearchFields } from "./page-search-frontmatter.js";
import {
  recmaBindTranslations,
  remarkCheckTranslationKeys,
  sqlReadsTranslations,
  translationsForExport,
} from "./page-translations.js";
import { remarkSpliceMdxEcho } from "./mdx-echo-fence.js";
import { NO_QUERY_FILES, remarkQueryFiles } from "./query-files.js";
import { remarkRejectReservedFilterIds } from "./reserved-filter-id.js";
import { remarkRejectUnknownSearchMethod } from "./search-method.js";
import { parseSqlFenceMeta } from "./sql-fence-meta.js";
import { assertNoSqlTableCollision, sqlTableMap } from "./sql-frontmatter.js";
import { NO_TRANSLATIONS } from "./resolve-translations.js";
import type {
  BrandTheme,
  CompiledPage,
  ExportedWidgetTag,
  PageFrontmatter,
  PageTranslationUse,
  QueryFiles,
  ResolvedTranslations,
  SqlBlock,
  SqlTableMap,
} from "./types.js";
import { remarkWidgetExports } from "./widget-export-sweep.js";

interface PageMetadata {
  /** Page path, for error messages that need to name their file. */
  filePath: string;
  sqlBlocks: SqlBlock[];
  exportedWidgets: ExportedWidgetTag[];
  /** First non-empty h1 text seen so far; null until one is found. */
  firstHeading: string | null;
}

/**
 * Compiles one markdown page into an ESM module plus its page metadata.
 *
 * Front-matter is pre-split from the source (invalid YAML throws — a broken
 * page fails loudly for its author); the body compiles with `format: "mdx"`
 * regardless of extension because pages carry JSX widgets (docs/architecture.md
 * §4). Named ` ```sql ` fences are collected into `sqlBlocks` but left in the
 * AST — they still render as code.
 *
 * `configTables` carries `biac.config.ts`'s project-wide `sql:` map — a
 * page name colliding with it is a compile error naming both sources.
 * `projectBrand` is its `brand`, which the page's own `brand:` colours are
 * contrast-checked against. `queryFiles` is the project's `queries/`
 * directory: each file a widget's `data="/queries/<path>"` names is read
 * and appended to `sqlBlocks` under that reference. `loadTranslations`
 * gives the project's resolved `translations.yaml`, asked for only when the
 * page names `$translations`; each literal key must exist in it.
 *
 * @example
 * const page = await compilePage("---\ntitle: T\n---\n```sql q\nselect 1\n```\n", "pages/a.md");
 * // page.title → "T"; page.sqlBlocks → [{name: "q", sql: "select 1"}]
 */
export async function compilePage(
  markdown: string,
  filePath: string,
  configTables: SqlTableMap = {},
  projectBrand: BrandTheme = NO_BRAND,
  queryFiles: QueryFiles = NO_QUERY_FILES,
  loadTranslations: () => Promise<ResolvedTranslations> = async () =>
    NO_TRANSLATIONS,
): Promise<CompiledPage> {
  const file = positionedPageFile(markdown, filePath);
  const frontmatter = pageFrontmatter(file);

  const metadata: PageMetadata = {
    filePath,
    sqlBlocks: [],
    exportedWidgets: [],
    firstHeading: null,
  };
  const translationUse: PageTranslationUse = { reads: false };
  const compiled = await compile(file, {
    format: "mdx",
    remarkPlugins: [
      remarkGfm,
      remarkSpliceMdxEcho,
      [remarkPageMetadata, metadata],
      [remarkQueryFiles, queryFiles, metadata.sqlBlocks],
      [remarkWidgetExports, metadata],
      remarkRejectReservedFilterIds,
      remarkRejectUnknownSearchMethod,
      [remarkCheckTranslationKeys, loadTranslations, translationUse],
    ],
    recmaPlugins: [[recmaBindTranslations, translationUse]],
  });

  const location = `front-matter in ${filePath}`;
  const sqlTables = sqlTableMap(frontmatter.sql, location);
  assertNoSqlTableCollision(sqlTables, configTables, location);
  assertPageIcon(frontmatter.icon, location);
  assertPageSearchFields(frontmatter, location);
  assertPageChrome(frontmatter, location);
  const page = {
    frontmatter,
    title: resolveTitle(frontmatter, metadata.firstHeading),
    sqlBlocks: metadata.sqlBlocks,
    sqlTables,
    exportedWidgets: metadata.exportedWidgets,
    layout: pageLayout(frontmatter, location),
    brandCss: brandCss(pageBrand(frontmatter, location, projectBrand)),
  };
  const readsTranslations =
    translationUse.reads || sqlReadsTranslations(page.sqlBlocks);
  const exports = readsTranslations
    ? [metadataExports(page), translationsForExport()]
    : [metadataExports(page)];
  return {
    code: `${compiled}\n${exports.join("\n")}\n`,
    readsTranslations,
    ...page,
  };
}

const remarkPageMetadata: Plugin<[PageMetadata], Root> =
  (metadata) => (tree) => {
    visit(tree, "code", (node: Code) => registerSqlBlock(node, metadata));
    visit(tree, "heading", (node: Heading) => {
      if (node.depth !== 1 || metadata.firstHeading !== null) return;
      const text = toPlainText(node).trim();
      if (text) metadata.firstHeading = text;
    });
  };

/**
 * Records a named sql fence in the page metadata and tags its <code>
 * element with the block's name and display flags; unnamed and non-sql
 * fences pass through untouched.
 *
 * @example
 * registerSqlBlock(codeNode, metadata); // ```sql orders echo → meta="orders" echo
 */
function registerSqlBlock(node: Code, metadata: PageMetadata): void {
  if (node.lang !== "sql") return;
  if (!node.meta?.trim()) return;
  const location = `${metadata.filePath}:${node.position?.start.line ?? "?"}`;
  const { name, echo, display } = parseSqlFenceMeta(node.meta, location);
  if (metadata.sqlBlocks.some((block) => block.name === name)) {
    throw new Error(`Duplicate sql block name "${name}" at ${location}`);
  }
  metadata.sqlBlocks.push({ name, sql: node.value });
  // The block name and its display flags must reach the rendered page:
  // MDX drops mdast `meta`, so they ride hast `hProperties` into props on
  // the <code> element for the web's `pre` override to read. A flag is an
  // HTML boolean attribute — present as "" when on, absent when off — since
  // the <code> element reaches the DOM before highlighting and React rejects
  // `true` for a non-boolean attribute.
  node.data = {
    ...node.data,
    hProperties: {
      ...node.data?.hProperties,
      meta: name,
      ...(echo && { echo: "" }),
      ...(display && { display: "" }),
    },
  };
}

function resolveTitle(
  frontmatter: PageFrontmatter,
  firstHeading: string | null,
): string | null {
  const title = frontmatter.title;
  if (title === undefined) return firstHeading;
  return title === null ? null : String(title);
}

function metadataExports(
  page: Omit<CompiledPage, "code" | "readsTranslations">,
): string {
  return [
    `export const frontmatter = ${JSON.stringify(page.frontmatter)};`,
    `export const title = ${JSON.stringify(page.title)};`,
    `export const sqlBlocks = ${JSON.stringify(page.sqlBlocks)};`,
    `export const sqlTables = ${JSON.stringify(page.sqlTables)};`,
    `export const layout = ${JSON.stringify(page.layout)};`,
    `export const brandCss = ${JSON.stringify(page.brandCss)};`,
  ].join("\n");
}
