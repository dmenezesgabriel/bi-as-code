import { compile } from "@mdx-js/mdx";
import type { Code, Heading, Root } from "mdast";
import { toString as toPlainText } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { matter } from "vfile-matter";
import { pageFrontmatter } from "./page-frontmatter.js";
import { sqlTableMap } from "./sql-frontmatter.js";
import type { CompiledPage, PageFrontmatter, SqlBlock } from "./types.js";

interface PageMetadata {
  /** Page path, for error messages that need to name their file. */
  filePath: string;
  sqlBlocks: SqlBlock[];
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
 * @example
 * const page = await compilePage("---\ntitle: T\n---\n```sql q\nselect 1\n```\n", "pages/a.md");
 * // page.title → "T"; page.sqlBlocks → [{name: "q", sql: "select 1"}]
 */
export async function compilePage(
  markdown: string,
  filePath: string,
): Promise<CompiledPage> {
  const file = new VFile({ path: filePath, value: markdown });
  matter(file, { strip: true });
  const frontmatter = pageFrontmatter(file);

  const metadata: PageMetadata = {
    filePath,
    sqlBlocks: [],
    firstHeading: null,
  };
  const compiled = await compile(file, {
    format: "mdx",
    remarkPlugins: [remarkGfm, [remarkPageMetadata, metadata]],
  });

  const page = {
    frontmatter,
    title: resolveTitle(frontmatter, metadata.firstHeading),
    sqlBlocks: metadata.sqlBlocks,
    sqlTables: sqlTableMap(frontmatter, filePath),
  };
  return { code: `${compiled}\n${metadataExports(page)}\n`, ...page };
}

const remarkPageMetadata: Plugin<[PageMetadata], Root> =
  (metadata) => (tree) => {
    visit(tree, "code", (node: Code) => {
      if (node.lang !== "sql") return;
      const name = node.meta?.trim();
      if (!name) return;
      if (metadata.sqlBlocks.some((block) => block.name === name)) {
        throw new Error(
          `Duplicate sql block name "${name}" at ${metadata.filePath}:${node.position?.start.line ?? "?"}`,
        );
      }
      metadata.sqlBlocks.push({ name, sql: node.value });
    });
    visit(tree, "heading", (node: Heading) => {
      if (node.depth !== 1 || metadata.firstHeading !== null) return;
      const text = toPlainText(node).trim();
      if (text) metadata.firstHeading = text;
    });
  };

function resolveTitle(
  frontmatter: PageFrontmatter,
  firstHeading: string | null,
): string | null {
  const title = frontmatter.title;
  if (title === undefined) return firstHeading;
  return title === null ? null : String(title);
}

function metadataExports(page: Omit<CompiledPage, "code">): string {
  return [
    `export const frontmatter = ${JSON.stringify(page.frontmatter)};`,
    `export const title = ${JSON.stringify(page.title)};`,
    `export const sqlBlocks = ${JSON.stringify(page.sqlBlocks)};`,
    `export const sqlTables = ${JSON.stringify(page.sqlTables)};`,
  ].join("\n");
}
