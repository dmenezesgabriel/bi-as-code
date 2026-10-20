import { createInstance, type i18n } from "i18next";
import { readTranslationsFile } from "./translations-file.js";
import type {
  ResolvedTranslations,
  TranslationMap,
  TranslationsFile,
} from "./types.js";

/** The language whose value stands in for a key another language leaves out. */
const FALLBACK_LANGUAGE = "en";

/** A project without `translations.yaml`. */
export const NO_TRANSLATIONS: ResolvedTranslations = {
  languages: [],
  byLanguage: {},
};

/**
 * Reads the project's `translations.yaml` and resolves it; a project without
 * the file resolves to no languages.
 *
 * @example
 * await loadProjectTranslations("/site"); // → { languages: ["en", "fr"], byLanguage: {…} }
 */
export async function loadProjectTranslations(
  root: string,
): Promise<ResolvedTranslations> {
  return resolveTranslations(readTranslationsFile(root));
}

/**
 * Resolves every declared language once, at build time, so the browser only
 * picks a finished map: the `en` translations merged under the language's
 * own, key by key, then each value run through i18next so `$t(key)` expands
 * to that key's text — the nesting syntax i18next documents
 * (https://www.i18next.com/translation-function/nesting).
 *
 * @example
 * await resolveTranslations({ en: { a: "A", b: "B" }, fr: { a: "A fr" } });
 * // → { languages: ["en", "fr"], byLanguage: { en: {…}, fr: { a: "A fr", b: "B" } } }
 */
export async function resolveTranslations(
  file: TranslationsFile,
): Promise<ResolvedTranslations> {
  const languages = Object.keys(file);
  const maps = await Promise.all(
    languages.map((language) => resolveLanguage(file, language)),
  );
  return {
    languages,
    byLanguage: Object.fromEntries(
      languages.map((language, index) => [language, maps[index]!]),
    ),
  };
}

async function resolveLanguage(
  file: TranslationsFile,
  language: string,
): Promise<TranslationMap> {
  const merged = mergeMaps(file[FALLBACK_LANGUAGE] ?? {}, file[language] ?? {});
  const translator = createInstance();
  await translator.init({
    lng: language,
    resources: { [language]: { translation: merged } },
    // The values reach React as text, which escapes them when it renders.
    interpolation: { escapeValue: false },
  });
  return expandLeaves(merged, translator, "");
}

function mergeMaps(base: TranslationMap, over: TranslationMap): TranslationMap {
  const merged: TranslationMap = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const under = merged[key];
    merged[key] =
      typeof value === "object" && typeof under === "object"
        ? mergeMaps(under, value)
        : value;
  }
  return merged;
}

function expandLeaves(
  map: TranslationMap,
  translator: i18n,
  prefix: string,
): TranslationMap {
  const expanded: TranslationMap = {};
  for (const [key, value] of Object.entries(map)) {
    const path = `${prefix}${key}`;
    expanded[key] =
      typeof value === "string"
        ? translator.t(path)
        : expandLeaves(value, translator, `${path}.`);
  }
  return expanded;
}
