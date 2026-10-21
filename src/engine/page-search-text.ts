import { createProcessor } from "@mdx-js/mdx";
import type { Nodes } from "mdast";
import remarkGfm from "remark-gfm";
import { SKIP, visit } from "unist-util-visit";
import { expressionTranslationKey } from "./page-translations.js";
import type { TranslationMap } from "./types.js";

/**
 * The prose a reader sees on a page, as one space-joined string for site
 * search. Code fences are left out (sql is not prose), and so is any JSX
 * element with a `data` attribute — a widget rendering query results,
 * which change with the data. Layout elements (`<Callout>`, `<Details>`)
 * keep their text. A `{$translations.key}` contributes its text in
 * `translations`, so a translated heading is found by what it says.
 * `body` is the page without its front-matter block.
 *
 * @example
 * pageSearchText("# {$translations.title}\n", { title: "Revue" });
 * // → "Revue"
 */
export function pageSearchText(
  body: string,
  translations: TranslationMap,
): string {
  // Parse only: remark-gfm's syntax (tables) applies while parsing, and
  // running the pipeline would turn the tree into JavaScript.
  const processor = createProcessor({
    format: "mdx",
    remarkPlugins: [remarkGfm],
  });
  const tree = processor.parse(body);
  const words: string[] = [];
  visit(tree, (node: Nodes) => {
    if (node.type === "code" || readsData(node)) return SKIP;
    const text = nodeText(node, translations);
    if (text) words.push(text);
  });
  return words.join(" ").replace(/\s+/g, " ").trim();
}

function nodeText(node: Nodes, translations: TranslationMap): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  if (node.type !== "mdxTextExpression" && node.type !== "mdxFlowExpression")
    return "";
  const key = expressionTranslationKey(node);
  return key === undefined ? "" : translationText(translations, key);
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
