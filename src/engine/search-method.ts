import type { Root } from "mdast";
import type { MdxJsxAttribute } from "mdast-util-mdx-jsx";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { didYouMean } from "./closest-key.js";
import { literalStrings } from "./reserved-filter-id.js";

/**
 * The match methods `<Search>` accepts — DuckDB's `contains`, `prefix` and
 * `suffix`. A `regexp` method is left out: an unfinished pattern (`[a`)
 * typed into the box is a query error on every widget the filter names.
 * The browser declares the same set as `SearchMethod` in
 * `src/web/src/features/widgets/inputs/types.ts`; the engine and the SPA
 * share no module.
 */
const SEARCH_METHODS: readonly string[] = ["contains", "prefix", "suffix"];

/**
 * Remark plugin that fails a page whose `<Search method>` names a method
 * outside `contains | prefix | suffix`, at the position of the attribute.
 * Only methods written as literals are read: a computed one is not known
 * until the page runs.
 *
 * @example
 * await compile('<Search id="q" column="region" method="regexp" />', {
 *   remarkPlugins: [remarkRejectUnknownSearchMethod],
 * }); // throws: Unknown method "regexp" on <Search method> — …
 */
export const remarkRejectUnknownSearchMethod: Plugin<[], Root> =
  () => (tree, file) => {
    visit(tree, (node) => {
      if (
        node.type !== "mdxJsxFlowElement" &&
        node.type !== "mdxJsxTextElement"
      )
        return;
      if (node.name !== "Search") return;
      for (const attribute of node.attributes) {
        if (attribute.type !== "mdxJsxAttribute") continue;
        if (attribute.name === "method") rejectUnknownMethod(attribute, file);
      }
    });
  };

function rejectUnknownMethod(attribute: MdxJsxAttribute, file: VFile): void {
  for (const method of literalStrings(attribute.value)) {
    if (SEARCH_METHODS.includes(method)) continue;
    file.fail(
      `Unknown method "${method}" on <Search method> — expected one of ${SEARCH_METHODS.join(", ")}${didYouMean(method, SEARCH_METHODS)}`,
      attribute.position,
    );
  }
}
