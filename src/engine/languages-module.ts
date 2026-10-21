/** The module the app shell reads the declared languages from. */
export const VIRTUAL_LANGUAGES_ID = "virtual:biac-languages";

/**
 * Source of `virtual:biac-languages`: the languages `translations.yaml`
 * declares, as a store (`getLanguages` + `subscribeLanguages`) the header's
 * language menu reads. It is kept apart from `virtual:biac-translations` so
 * the shell never imports the translated text: a broken file then fails
 * only the pages that read it, and a saved one hot-updates them in place.
 *
 * In dev the module accepts its own updates. The list lives in
 * `import.meta.hot.data`, which every evaluation of the module shares, so
 * the shell — still holding the first evaluation's functions — reads the
 * newest list and its listeners hear of it. `import.meta.hot` is undefined
 * in a production build, so the guarded block is dropped there.
 *
 * @example
 * languagesModuleSource(["en", "fr"]);
 * // → 'const store = import.meta.hot?.data.store ?? …;\nstore.languages = ["en","fr"];\n…'
 */
export function languagesModuleSource(languages: readonly string[]): string {
  return [
    "const store = import.meta.hot?.data.store ?? { languages: [], listeners: new Set() };",
    `store.languages = ${JSON.stringify(languages)};`,
    "export function getLanguages() {",
    "  return store.languages;",
    "}",
    "export function subscribeLanguages(listener) {",
    "  store.listeners.add(listener);",
    "  return () => void store.listeners.delete(listener);",
    "}",
    "if (import.meta.hot) {",
    "  import.meta.hot.data.store = store;",
    "  import.meta.hot.accept(() => store.listeners.forEach((listener) => listener()));",
    "}",
    "",
  ].join("\n");
}
