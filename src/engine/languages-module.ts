import { hotStoreSource } from "./hot-store-source.js";

/** The module the app shell reads the declared languages from. */
export const VIRTUAL_LANGUAGES_ID = "virtual:biac-languages";

/**
 * Source of `virtual:biac-languages`: the languages `translations.yaml`
 * declares, as a store (`getLanguages` + `subscribeLanguages`) the header's
 * language menu reads. It is kept apart from `virtual:biac-translations` so
 * the shell never imports the translated text: a broken file then fails
 * only the pages that read it, and a saved one hot-updates them in place.
 *
 * In dev the module hot-updates itself ({@link hotStoreSource}).
 *
 * @example
 * languagesModuleSource(["en", "fr"]);
 * // → 'const store = import.meta.hot?.data.store ?? …;\nObject.assign(store, {"languages":["en","fr"]});\n…'
 */
export function languagesModuleSource(languages: readonly string[]): string {
  return [
    ...hotStoreSource({ languages }, "subscribeLanguages"),
    "export function getLanguages() {",
    "  return store.languages;",
    "}",
    "",
  ].join("\n");
}
