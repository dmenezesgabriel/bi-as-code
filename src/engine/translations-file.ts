import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { isMap, isScalar, isSeq, LineCounter, parseDocument } from "yaml";
import type {
  TranslationMap,
  TranslationValue,
  TranslationsFile,
} from "./types.js";

/** The project-root file a project's translations live in. */
export const TRANSLATIONS_FILE = "translations.yaml";

// CLDR names every ISO 639-1 code, so a two-letter code it cannot name is
// not one — no 184-code list to keep in step with the standard.
const languageNames = new Intl.DisplayNames(["en"], {
  type: "language",
  fallback: "none",
});

/** Throws the located error for a node of the file. */
type FailAt = (reason: string, node: unknown) => never;

/**
 * Reads `translations.yaml` from the project root; a project without one
 * has no languages.
 *
 * @example
 * readTranslationsFile("/site"); // → { en: { revenue: "Revenue" }, fr: { … } }
 */
export function readTranslationsFile(root: string): TranslationsFile {
  const file = join(root, TRANSLATIONS_FILE);
  if (!existsSync(file)) return {};
  return parseTranslations(readFileSync(file, "utf8"), file);
}

/**
 * Parses the text of a translations file: language code → translations,
 * each value text (numbers and booleans become their text) or a nested map.
 * Anything else — malformed YAML, a key that is not an ISO 639-1 code, a
 * list or empty value — throws an error naming its line and column, in the
 * shape vite's error overlay reads (`id`, `loc`).
 *
 * @example
 * parseTranslations("en:\n  revenue: Revenue\n", "/site/translations.yaml");
 * // → { en: { revenue: "Revenue" } }
 */
export function parseTranslations(
  source: string,
  file: string,
): TranslationsFile {
  const lineCounter = new LineCounter();
  const document = parseDocument(source, { lineCounter });
  const failAtOffset = (reason: string, offset: number): never => {
    const { line, col } = lineCounter.linePos(offset);
    throw locatedTranslationsError(reason, file, line, col);
  };
  const [syntaxError] = document.errors;
  if (syntaxError)
    failAtOffset(firstLine(syntaxError.message), syntaxError.pos[0]);
  const failAt: FailAt = (reason, node) => failAtOffset(reason, startOf(node));
  return languagesOf(document.contents, failAt);
}

function languagesOf(root: unknown, failAt: FailAt): TranslationsFile {
  if (root === null) return {};
  if (!isMap(root)) {
    failAt(
      `the file must map language codes to translations, got ${describe(root)}`,
      root,
    );
  }
  const translations: TranslationsFile = {};
  for (const { key, value } of root.items) {
    const language = String(isScalar(key) ? key.value : key);
    if (!isLanguageCode(language)) {
      failAt(
        `"${language}" is not an ISO 639-1 language code (expected two letters such as en or fr)`,
        key,
      );
    }
    translations[language] = translationMap(value, language, failAt);
  }
  return translations;
}

function translationMap(
  node: unknown,
  path: string,
  failAt: FailAt,
): TranslationMap {
  if (!isMap(node))
    failAt(
      `${path} must map keys to translations, got ${describe(node)}`,
      node,
    );
  const map: TranslationMap = {};
  for (const { key, value } of node.items) {
    const name = String(isScalar(key) ? key.value : key);
    map[name] = translationValue(value, `${path}.${name}`, failAt);
  }
  return map;
}

function translationValue(
  node: unknown,
  path: string,
  failAt: FailAt,
): TranslationValue {
  if (isMap(node)) return translationMap(node, path, failAt);
  if (isScalar(node) && isText(node.value)) return String(node.value);
  return failAt(
    `${path} must be a string, number, boolean or nested map, got ${describe(node)}`,
    node,
  );
}

function isText(value: unknown): value is string | number | boolean {
  return ["string", "number", "boolean"].includes(typeof value);
}

function isLanguageCode(code: string): boolean {
  return /^[a-z]{2}$/.test(code) && languageNames.of(code) !== undefined;
}

function describe(node: unknown): string {
  if (isSeq(node)) return "a list";
  if (isMap(node)) return "a map";
  if (isScalar(node)) return node.value === null ? "null" : typeof node.value;
  return "null";
}

/** The offset a node starts at; a value left empty has no node, so 0. */
function startOf(node: unknown): number {
  if (isMap(node) || isSeq(node) || isScalar(node)) return node.range?.[0] ?? 0;
  return 0;
}

// The parser appends " at line L, column C:" and a source excerpt; the
// error's own prefix already names the position.
function firstLine(message: string): string {
  return message.split("\n")[0]!.replace(/ at line \d+, column \d+:$/, "");
}

function locatedTranslationsError(
  reason: string,
  file: string,
  line: number,
  column: number,
): Error {
  return Object.assign(
    new Error(`Invalid ${basename(file)}:${line}:${column} — ${reason}`),
    { id: file, loc: { file, line, column } },
  );
}
