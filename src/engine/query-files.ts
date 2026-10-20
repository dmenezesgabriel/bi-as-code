import type { Root } from "mdast";
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

/**
 * Remark plugin that reads each query file a widget's `data` names —
 * `data="/queries/sales/totals"` reads `queries/sales/totals.sql` — and
 * appends it to `sqlBlocks` under that reference, so the page module
 * carries only the files it uses. A reference whose file is missing fails
 * the page at the attribute, naming the closest file that exists. Only
 * literal values are read: a computed one is not known until the page runs.
 *
 * @example
 * await compile('<Table data="/queries/totals" />', {
 *   remarkPlugins: [[remarkQueryFiles, diskQueryFiles(root), sqlBlocks]],
 * }); // sqlBlocks → [{ name: "/queries/totals", sql: "select …" }]
 */
export const remarkQueryFiles: Plugin<[QueryFiles, SqlBlock[]], Root> =
  (queryFiles, sqlBlocks) => async (tree, file) => {
    for (const [reference, attribute] of dataReferences(tree)) {
      const sql = await readReferenced(queryFiles, reference, attribute, file);
      sqlBlocks.push({ name: reference, sql });
    }
  };

/** Every distinct root-path `data` value, with the first attribute naming it. */
function dataReferences(tree: Root): Map<string, MdxJsxAttribute> {
  const references = new Map<string, MdxJsxAttribute>();
  visit(tree, (node) => {
    if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement")
      return;
    for (const attribute of node.attributes) record(attribute, references);
  });
  return references;
}

function record(
  attribute: MdxJsxAttribute | MdxJsxExpressionAttribute,
  references: Map<string, MdxJsxAttribute>,
): void {
  if (attribute.type !== "mdxJsxAttribute" || attribute.name !== "data") return;
  for (const value of literalStrings(attribute.value)) {
    // Fence names never start with "/", so a root path is always a file.
    if (value.startsWith("/") && !references.has(value)) {
      references.set(value, attribute);
    }
  }
}

async function readReferenced(
  queryFiles: QueryFiles,
  reference: string,
  attribute: MdxJsxAttribute,
  file: VFile,
): Promise<string> {
  if (!reference.startsWith(QUERIES_PREFIX)) {
    file.fail(
      `data="${reference}" names no query file — expected data="/queries/<path>" for queries/<path>.sql`,
      attribute.position,
    );
  }
  const name = `${reference.slice(QUERIES_PREFIX.length)}.sql`;
  const sql = await queryFiles.read(name);
  if (sql !== undefined) return sql;
  file.fail(
    await missingFileMessage(queryFiles, name, reference),
    attribute.position,
  );
}

async function missingFileMessage(
  queryFiles: QueryFiles,
  name: string,
  reference: string,
): Promise<string> {
  const known = (await queryFiles.list()).map(
    (listed) => `${QUERIES_PREFIX}${listed.slice(0, -".sql".length)}`,
  );
  return `Query file queries/${name} not found for data="${reference}"${didYouMean(reference, known)}`;
}
