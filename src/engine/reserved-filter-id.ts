import type { Root } from "mdast";
import type { MdxJsxAttribute } from "mdast-util-mdx-jsx";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

/**
 * The URL search key the source editor owns in `biac dev` (ADR-0010). A page
 * filter persists under its id as a search key, so a filter with this id
 * would open the editor whenever it held a value. Matched exactly: search
 * keys are case-sensitive, so `Edit` is an ordinary filter id. The browser
 * declares the same key in `src/web/src/features/editor/edit-search.ts`;
 * the engine and the SPA share no module.
 */
const EDITOR_SEARCH_KEY = "edit";

/**
 * The tags whose `id` is a filter id. Other tags use `id` for something
 * else (`<Column id>` names a column), so the check goes by tag. The tags
 * themselves are registered in `src/web/src/features/pages/markdown-page.tsx`;
 * a new input belongs in both places.
 */
const FILTER_INPUT_TAGS: ReadonlySet<string> = new Set([
  "Dropdown",
  "MultiSelect",
  "Slider",
  "ButtonGroup",
  "TextInput",
  "Toggle",
  "DateRange",
]);

/**
 * Remark plugin that fails a page naming a filter with the source editor's
 * URL key — as an input's `id` or in any tag's `filters` — at the position
 * of the attribute that does it. Only ids written as literals are read: an
 * id computed by an expression is not known until the page runs.
 *
 * @example
 * await compile('<TextInput id="edit" />', {
 *   remarkPlugins: [remarkRejectReservedFilterIds],
 * }); // throws: Reserved filter id "edit" on <TextInput id> — …
 */
export const remarkRejectReservedFilterIds: Plugin<[], Root> =
  () => (tree, file) => {
    visit(tree, (node) => {
      if (
        node.type !== "mdxJsxFlowElement" &&
        node.type !== "mdxJsxTextElement"
      )
        return;
      for (const attribute of node.attributes) {
        if (attribute.type !== "mdxJsxAttribute") continue;
        rejectReservedFilterId(node.name, attribute, file);
      }
    });
  };

function rejectReservedFilterId(
  tagName: string | null,
  attribute: MdxJsxAttribute,
  file: VFile,
): void {
  if (!namesFilterIds(tagName, attribute)) return;
  if (!literalStrings(attribute.value).includes(EDITOR_SEARCH_KEY)) return;
  file.fail(
    `Reserved filter id "${EDITOR_SEARCH_KEY}" on <${tagName} ${attribute.name}> — "${EDITOR_SEARCH_KEY}" opens the source editor in biac dev; choose another id`,
    attribute.position,
  );
}

function namesFilterIds(
  tagName: string | null,
  attribute: MdxJsxAttribute,
): boolean {
  if (attribute.name === "filters") return true;
  if (attribute.name !== "id" || tagName === null) return false;
  return FILTER_INPUT_TAGS.has(tagName);
}

/**
 * The strings an attribute value spells out in the source: the string
 * itself, a string literal expression, or the string literals of an array
 * expression. Anything else yields nothing.
 */
function literalStrings(value: MdxJsxAttribute["value"]): string[] {
  if (typeof value === "string") return [value];
  const statement = value?.data?.estree?.body[0];
  if (statement?.type !== "ExpressionStatement") return [];
  const { expression } = statement;
  const candidates =
    expression.type === "ArrayExpression" ? expression.elements : [expression];
  return candidates.flatMap((candidate) =>
    candidate?.type === "Literal" && typeof candidate.value === "string"
      ? [candidate.value]
      : [],
  );
}
