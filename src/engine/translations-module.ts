import type { ResolvedTranslations } from "./types.js";

/** The module a page that reads `$translations` imports its text from. */
export const VIRTUAL_TRANSLATIONS_ID = "virtual:biac-translations";

/**
 * Source of `virtual:biac-translations`: the declared `languages`, every
 * language's resolved `translations`, and `translationsFor(language)` — the
 * map a page renders, the first declared language's when `language` is not
 * one of them, empty when none is declared. A page module imports it, so an
 * edit to `translations.yaml` reaches the page through the page's own hot
 * update.
 *
 * @example
 * translationsModuleSource({ languages: ["en"], byLanguage: { en: { a: "A" } } });
 * // → 'export const languages = ["en"];\nexport const translations = {"en":{"a":"A"}};\n…'
 */
export function translationsModuleSource(
  resolved: ResolvedTranslations,
): string {
  return [
    `export const languages = ${JSON.stringify(resolved.languages)};`,
    `export const translations = ${JSON.stringify(resolved.byLanguage)};`,
    "export function translationsFor(language) {",
    // `hasOwn`, not `in`: a language read from a URL may be "constructor".
    "  if (Object.hasOwn(translations, language)) return translations[language];",
    "  return translations[languages[0]] ?? {};",
    "}",
    "",
  ].join("\n");
}
