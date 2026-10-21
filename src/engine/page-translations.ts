import type { Nodes, Root } from "mdast";
import type {
  MdxJsxAttribute,
  MdxJsxAttributeValueExpression,
  MdxJsxExpressionAttribute,
} from "mdast-util-mdx-jsx";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { didYouMean } from "./closest-key.js";
import { VIRTUAL_TRANSLATIONS_ID } from "./translations-module.js";
import type {
  PageTranslationUse,
  ResolvedTranslations,
  SqlBlock,
  TranslationMap,
} from "./types.js";

/** The name a page reads its translations by. */
const TRANSLATIONS_BINDING = "$translations";
/** The local the page module imports `translationsFor` as. */
const TRANSLATIONS_FOR = "_translationsFor";

type EstreeProgram = NonNullable<
  NonNullable<MdxJsxAttributeValueExpression["data"]>["estree"]
>;
type EstreeStatement = EstreeProgram["body"][number];
type EstreeFunctionStatement = Extract<
  EstreeStatement,
  { type: "FunctionDeclaration" }
>["body"]["body"][number];

/** An estree node, as far as walking it needs. */
interface EstreeNode {
  type: string;
  [field: string]: unknown;
}

/** A non-computed `$translations.a.b` the page spells out, and where. */
interface TranslationReference {
  key: string;
  line: number;
  /** 1-based, as a page compile error reports it. */
  column: number;
}

/**
 * Remark plugin that finds every `$translations` a page's expressions name
 * — in text (`{$translations.revenue}`) or a tag attribute
 * (`title={$translations.revenue}`) — and records in `use` whether there is
 * one. Each key spelled out as a literal must be text in every declared
 * language, or some language would render nothing: an unknown key fails the
 * page at its position, naming the closest key. Translations are loaded only
 * for a page that reads them; a key computed when the page runs is not
 * checked.
 *
 * @example
 * await compile("# {$translations.revenu}", {
 *   remarkPlugins: [[remarkCheckTranslationKeys, loadTranslations, use]],
 * }); // throws: Undefined translation key: $translations.revenu (did you mean $translations.revenue?)
 */
export const remarkCheckTranslationKeys: Plugin<
  [() => Promise<ResolvedTranslations>, PageTranslationUse],
  Root
> = (loadTranslations, use) => async (tree, file) => {
  const programs: unknown[] = [];
  visit(tree, (node) => void programs.push(...estreePrograms(node)));
  const references: TranslationReference[] = [];
  for (const program of programs) {
    use.reads = collectReferences(program, references) || use.reads;
  }
  if (references.length === 0) return;
  const keys = textKeys(await loadTranslations());
  for (const reference of references) failUnknownKey(reference, keys, file);
};

/**
 * Recma plugin that gives a page reading `$translations` its binding: the
 * module imports `translationsFor` from `virtual:biac-translations`, and the
 * MDX content function declares `$translations` from the language the page
 * is rendered with (`props.language`; the first declared when absent). MDX
 * offers no option to inject a variable, and a binding per render — not per
 * module — lets the language change without recompiling the page.
 *
 * @example
 * await compile("# {$translations.title}", {
 *   recmaPlugins: [[recmaBindTranslations, { reads: true }]],
 * }); // function _createMdxContent(props) { const $translations = _translationsFor(props.language); …
 */
export const recmaBindTranslations: Plugin<
  [PageTranslationUse],
  EstreeProgram
> = (use) => (program) => {
  if (!use.reads) return;
  const content = program.body.find(
    (statement) =>
      statement.type === "FunctionDeclaration" &&
      statement.id.name === "_createMdxContent",
  );
  if (content?.type !== "FunctionDeclaration") {
    throw new Error(
      `Cannot bind ${TRANSLATIONS_BINDING}: the compiled page has no _createMdxContent function (expected @mdx-js/mdx's content function)`,
    );
  }
  content.body.body.unshift(translationsBinding());
  program.body.unshift(translationsForImport());
};

/** A `{{$translations.…}}` token in sql, spaces inside the braces allowed. */
const SQL_TRANSLATION_TOKEN = /\{\{\s*\$translations\./;

/**
 * Whether any of a page's sql blocks — its fences and the query files it
 * reads — binds a `{{$translations.key}}`. The browser binds those values
 * when the query runs, from the `translationsFor` the page module
 * re-exports (`translationsForExport`).
 *
 * @example
 * sqlReadsTranslations([{ name: "q", sql: "select {{$translations.west}}" }]); // → true
 */
export function sqlReadsTranslations(sqlBlocks: readonly SqlBlock[]): boolean {
  return sqlBlocks.some((block) => SQL_TRANSLATION_TOKEN.test(block.sql));
}

/**
 * The page-module line that hands the browser `translationsFor`, so the
 * query registry binds `{{$translations.*}}` in the page's language.
 *
 * @example
 * translationsForExport(); // → 'export {translationsFor} from "virtual:biac-translations";'
 */
export function translationsForExport(): string {
  return `export {translationsFor} from ${JSON.stringify(VIRTUAL_TRANSLATIONS_ID)};`;
}

/** The estree programs an mdast node carries: its own expression and its attributes'. */
function estreePrograms(node: Nodes): unknown[] {
  const own = (node.data as { estree?: unknown } | undefined)?.estree;
  if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement")
    return [own];
  return [own, ...node.attributes.flatMap(attributePrograms)];
}

function attributePrograms(
  attribute: MdxJsxAttribute | MdxJsxExpressionAttribute,
): unknown[] {
  if (attribute.type === "mdxJsxExpressionAttribute")
    return [attribute.data?.estree];
  const { value } = attribute;
  return typeof value === "object" ? [value?.data?.estree] : [];
}

/**
 * Adds the literal keys under `node` to `found`; true when `node` names
 * `$translations` at all. A `$translations.a.b` chain is taken whole, so
 * its inner `$translations.a` is not a key of its own.
 */
function collectReferences(
  node: unknown,
  found: TranslationReference[],
): boolean {
  if (!isEstreeNode(node)) return false;
  const reference = literalReference(node);
  if (reference) found.push(reference);
  if (reference || isTranslationsIdentifier(node)) return true;
  let reads = false;
  for (const child of Object.values(node).flat()) {
    reads = collectReferences(child, found) || reads;
  }
  return reads;
}

function literalReference(node: EstreeNode): TranslationReference | undefined {
  const path = memberPath(node);
  const start = (node.loc as { start: { line: number; column: number } })
    ?.start;
  if (!path || !start) return;
  return { key: path.join("."), line: start.line, column: start.column + 1 };
}

/** `["a", "b"]` for `$translations.a.b`; undefined for anything else. */
function memberPath(node: EstreeNode): string[] | undefined {
  if (node.type !== "MemberExpression" || node.computed) return;
  const property = node.property as EstreeNode;
  if (property.type !== "Identifier") return;
  const object = node.object as EstreeNode;
  const head = isTranslationsIdentifier(object) ? [] : memberPath(object);
  return head && [...head, property.name as string];
}

function isTranslationsIdentifier(node: EstreeNode): boolean {
  return node.type === "Identifier" && node.name === TRANSLATIONS_BINDING;
}

function isEstreeNode(value: unknown): value is EstreeNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

/** The dotted keys that are text in every declared language. */
function textKeys(resolved: ResolvedTranslations): string[] {
  const [first, ...rest] = resolved.languages.map((language) =>
    leafKeys(resolved.byLanguage[language] ?? {}, ""),
  );
  if (!first) return [];
  return first.filter((key) => rest.every((keys) => keys.includes(key)));
}

function leafKeys(map: TranslationMap, prefix: string): string[] {
  return Object.entries(map).flatMap(([key, value]) =>
    typeof value === "string"
      ? [`${prefix}${key}`]
      : leafKeys(value, `${prefix}${key}.`),
  );
}

function failUnknownKey(
  reference: TranslationReference,
  keys: readonly string[],
  file: VFile,
): void {
  if (keys.includes(reference.key)) return;
  const written = `${TRANSLATIONS_BINDING}.${reference.key}`;
  const accepted = keys.map((key) => `${TRANSLATIONS_BINDING}.${key}`);
  file.fail(
    `Undefined translation key: ${written}${didYouMean(written, accepted)}`,
    { line: reference.line, column: reference.column },
  );
}

/** `import {translationsFor as _translationsFor} from "virtual:biac-translations";` */
function translationsForImport(): EstreeStatement {
  return {
    type: "ImportDeclaration",
    specifiers: [
      {
        type: "ImportSpecifier",
        imported: { type: "Identifier", name: "translationsFor" },
        local: { type: "Identifier", name: TRANSLATIONS_FOR },
      },
    ],
    source: { type: "Literal", value: VIRTUAL_TRANSLATIONS_ID },
    attributes: [],
  };
}

/** `const $translations = _translationsFor(props.language);` */
function translationsBinding(): EstreeFunctionStatement {
  return {
    type: "VariableDeclaration",
    kind: "const",
    declarations: [
      {
        type: "VariableDeclarator",
        id: { type: "Identifier", name: TRANSLATIONS_BINDING },
        init: {
          type: "CallExpression",
          optional: false,
          callee: { type: "Identifier", name: TRANSLATIONS_FOR },
          arguments: [
            {
              type: "MemberExpression",
              computed: false,
              optional: false,
              object: { type: "Identifier", name: "props" },
              property: { type: "Identifier", name: "language" },
            },
          ],
        },
      },
    ],
  };
}
