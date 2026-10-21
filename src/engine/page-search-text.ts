import { createProcessor } from "@mdx-js/mdx";
import type { Nodes } from "mdast";
import remarkGfm from "remark-gfm";
import { SKIP, visit } from "unist-util-visit";
import { expressionTranslationKey } from "./page-translations.js";
import type { TranslationMap } from "./types.js";

/**
 * A page's prose, parsed once: literal text, or the key of a
 * `{$translations.key}` whose text depends on the language.
 */
export type PageProse = readonly (string | { readonly key: string })[];

/**
 * The prose a reader sees on a page, for site search. Code fences are left
 * out (sql is not prose), and so is any JSX element with a `data`
 * attribute — a widget rendering query results, which change with the
 * data. Layout elements (`<Callout>`, `<Details>`) keep their text. A
 * `{$translations.key}` is kept as its key, so one parse serves every
 * language through {@link proseText}. `body` is the page without its
 * front-matter block.
 *
 * @example
 * pageProse("# {$translations.title}\n\nWeekly.\n");
 * // → [{ key: "title" }, "Weekly."]
 */
export function pageProse(body: string): PageProse {
  // Parse only: remark-gfm's syntax (tables) applies while parsing, and
  // running the pipeline would turn the tree into JavaScript.
  const processor = createProcessor({
    format: "mdx",
    remarkPlugins: [remarkGfm],
  });
  const prose: (string | { key: string })[] = [];
  visit(processor.parse(body), (node: Nodes) => {
    if (node.type === "code" || readsData(node)) return SKIP;
    const segment = proseSegment(node);
    if (segment) prose.push(segment);
  });
  return prose;
}

/**
 * `prose` as one space-joined string, each translation key resolved in
 * `translations`; a key they lack contributes nothing.
 *
 * @example
 * proseText([{ key: "title" }, "Weekly."], { title: "Revue" });
 * // → "Revue Weekly."
 */
export function proseText(
  prose: PageProse,
  translations: TranslationMap,
): string {
  const words = prose.map((segment) =>
    typeof segment === "string"
      ? segment
      : translationText(translations, segment.key),
  );
  return words.join(" ").replace(/\s+/g, " ").trim();
}

function proseSegment(node: Nodes): string | { key: string } | undefined {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  if (node.type !== "mdxTextExpression" && node.type !== "mdxFlowExpression")
    return;
  const key = expressionTranslationKey(node);
  return key === undefined ? undefined : { key };
}

function readsData(node: Nodes): boolean {
  if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement")
    return false;
  return node.attributes.some(
    (attribute) =>
      attribute.type === "mdxJsxAttribute" && attribute.name === "data",
  );
}

function translationText(translations: TranslationMap, key: string): string {
  let value: TranslationMap[string] | undefined = translations;
  for (const part of key.split(".")) {
    if (typeof value !== "object" || !Object.hasOwn(value, part)) return "";
    value = value[part];
  }
  return typeof value === "string" ? value : "";
}
