import type { Root } from "mdast";
import type { MdxJsxAttribute } from "mdast-util-mdx-jsx";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

/**
 * The URL search keys the app itself owns, each with what it does. A page
 * filter persists under its id as a search key, so a filter named with one
 * would drive it: `edit` opens the source editor in `biac dev` (ADR-0010),
 * `lang` chooses the page language. Matched exactly: search keys are
 * case-sensitive, so `Edit` is an ordinary filter id. The browser declares
 * the same keys in `src/web/src/features/editor/edit-search.ts` and
 * `src/web/src/features/chrome/language.ts`; the engine and the SPA share
 * no module.
 */
const RESERVED_SEARCH_KEYS: ReadonlyMap<string, string> = new Map([
  ["edit", "opens the source editor in biac dev"],
  ["lang", "chooses the page language"],
]);

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
  "Search",
  "Toggle",
  "DateRange",
]);

/**
 * Remark plugin that fails a page naming a filter with a URL key the app
 * owns — as an input's `id` or in any tag's `filters` — at the position
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
  const reserved = literalStrings(attribute.value).find((id) =>
    RESERVED_SEARCH_KEYS.has(id),
  );
  if (reserved === undefined) return;
  file.fail(
    `Reserved filter id "${reserved}" on <${tagName} ${attribute.name}> — "${reserved}" ${RESERVED_SEARCH_KEYS.get(reserved)}; choose another id`,
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
export function literalStrings(value: MdxJsxAttribute["value"]): string[] {
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
