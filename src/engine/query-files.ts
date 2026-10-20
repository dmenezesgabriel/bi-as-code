import type { Code, Root } from "mdast";
import type {
  MdxJsxAttribute,
  MdxJsxExpressionAttribute,
} from "mdast-util-mdx-jsx";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { didYouMean } from "./closest-key.js";
import { literalStrings } from "./reserved-filter-id.js";
import type { QueryFiles, SqlBlock } from "./types.js";

const QUERIES_PREFIX = "/queries/";

/** A project with no `queries/` directory: every reference is missing. */
export const NO_QUERY_FILES: QueryFiles = {
  read: async () => undefined,
  list: async () => [],
};

/** Where a page names a query file: what to read, and where to fail if it is missing. */
interface QueryReference {
  /** The root path as written, e.g. `/queries/sales/totals`. */
  readonly name: string;
  /** How the author wrote it, quoted back in an error. */
  readonly writtenAs: string;
  readonly position: Code["position"];
}

// The web interpolator's token shape; a token is trimmed the same way.
// Fence names never start with "/", so a root-path token is always a file.
const TEMPLATE_TOKEN = /\{\{([^{}]*)\}\}/g;

/**
 * Remark plugin that reads each query file a page names — a widget's
 * `data="/queries/sales/totals"` or a named sql fence's
 * `{{/queries/sales/totals}}` reads `queries/sales/totals.sql` — and appends
 * it to `sqlBlocks` under that reference, so the page module carries only
 * the files it uses. A file may name other files the same way; each is read
 * once, so a cycle ships and the registry reports it when it runs. A
 * reference whose file is missing fails the page where the page wrote it,
 * naming the closest file that exists. Only literal `data` values are read:
 * a computed one is not known until the page runs.
 *
 * @example
 * await compile('<Table data="/queries/totals" />', {
 *   remarkPlugins: [[remarkQueryFiles, diskQueryFiles(root), sqlBlocks]],
 * }); // sqlBlocks → [{ name: "/queries/totals", sql: "select …" }]
 */
export const remarkQueryFiles: Plugin<[QueryFiles, SqlBlock[]], Root> =
  (queryFiles, sqlBlocks) => async (tree, file) => {
    const pending = pageReferences(tree);
    const read = new Set<string>();
    for (let next = pending.shift(); next; next = pending.shift()) {
      if (read.has(next.name)) continue;
      read.add(next.name);
      const sql = await readReferenced(queryFiles, next, file);
      sqlBlocks.push({ name: next.name, sql });
      pending.push(...nestedReferences(sql, next));
    }
  };

/**
 * The query files a compiled page read, from the project root: the blocks
 * `remarkQueryFiles` appended, which alone are named by a root path.
 *
 * @example
 * queryFilesRead([{ name: "/queries/totals", sql: "…" }, { name: "orders", sql: "…" }]);
 * // → ["queries/totals.sql"]
 */
export function queryFilesRead(sqlBlocks: readonly SqlBlock[]): string[] {
  return sqlBlocks
    .filter((block) => block.name.startsWith(QUERIES_PREFIX))
    .map((block) => fileOf(block.name));
}

/** Every root-path `data` value and named-fence file token, in page order. */
function pageReferences(tree: Root): QueryReference[] {
  const references: QueryReference[] = [];
  visit(tree, (node) => {
    if (node.type === "code") {
      references.push(...fenceReferences(node));
      return;
    }
    if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement")
      return;
    for (const attribute of node.attributes) {
      references.push(...dataReferences(attribute));
    }
  });
  return references;
}

function dataReferences(
  attribute: MdxJsxAttribute | MdxJsxExpressionAttribute,
): QueryReference[] {
  if (attribute.type !== "mdxJsxAttribute" || attribute.name !== "data")
    return [];
  return literalStrings(attribute.value)
    .filter((value) => value.startsWith("/"))
    .map((name) => ({
      name,
      writtenAs: `data="${name}"`,
      position: attribute.position,
    }));
}

/** An unnamed fence is never registered or run, so its tokens are inert. */
function fenceReferences(node: Code): QueryReference[] {
  if (node.lang !== "sql" || !node.meta?.trim()) return [];
  return fileTokens(node.value).map((name) => ({
    name,
    writtenAs: `{{${name}}}`,
    position: node.position,
  }));
}

/**
 * A file's own `{{/queries/…}}` tokens, located at the page reference that
 * pulled the file in. Evidence forbids tokens inside a file; this allows
 * them, `{{params.x}}` included, because the interpolator binds params as
 * `?` args and never splices their values into the SQL text.
 */
function nestedReferences(
  sql: string,
  parent: QueryReference,
): QueryReference[] {
  return fileTokens(sql).map((name) => ({
    name,
    writtenAs: `{{${name}}} in ${fileOf(parent.name)}`,
    position: parent.position,
  }));
}

function fileTokens(sql: string): string[] {
  return [...sql.matchAll(TEMPLATE_TOKEN)]
    .map((match) => (match[1] ?? "").trim())
    .filter((token) => token.startsWith("/"));
}

/** `/queries/sales/totals` → `sales/totals.sql`, the name under `queries/`. */
function queriesPath(name: string): string {
  return `${name.slice(QUERIES_PREFIX.length)}.sql`;
}

function fileOf(name: string): string {
  return `queries/${queriesPath(name)}`;
}

async function readReferenced(
  queryFiles: QueryFiles,
  reference: QueryReference,
  file: VFile,
): Promise<string> {
  if (!reference.name.startsWith(QUERIES_PREFIX)) {
    file.fail(shapeMessage(reference), reference.position);
  }
  const sql = await queryFiles.read(queriesPath(reference.name));
  if (sql !== undefined) return sql;
  file.fail(
    await missingFileMessage(queryFiles, reference),
    reference.position,
  );
}

function shapeMessage(reference: QueryReference): string {
  const expected = reference.writtenAs.startsWith("data=")
    ? 'data="/queries/<path>"'
    : "{{/queries/<path>}}";
  return `${reference.writtenAs} names no query file — expected ${expected} for queries/<path>.sql`;
}

async function missingFileMessage(
  queryFiles: QueryFiles,
  reference: QueryReference,
): Promise<string> {
  const known = (await queryFiles.list()).map(
    (listed) => `${QUERIES_PREFIX}${listed.slice(0, -".sql".length)}`,
  );
  return `Query file ${fileOf(reference.name)} not found for ${reference.writtenAs}${didYouMean(reference.name, known)}`;
}
