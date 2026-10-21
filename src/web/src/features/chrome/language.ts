/**
 * Page-language choice, persistence and application. The language is
 * chosen in the browser because `biac build` is a static folder with no
 * server to read a request (ADR-0008): a `?lang=` URL wins, then the
 * reader's last menu pick in `localStorage`, then the first language
 * `translations.yaml` declares. Every storage access is guarded like the
 * theme's: storage can throw in private modes.
 */

/**
 * The URL search key that names the page language. The engine reserves the
 * same key as a filter id in `src/engine/reserved-filter-id.ts`; the engine
 * and the SPA share no module.
 */
export const LANGUAGE_SEARCH_KEY = "lang";

const STORAGE_KEY = "biac.lang";

/**
 * The language a page renders: `requested` (the URL's value) when it is
 * declared, else `stored` when declared, else the first declared language;
 * undefined when the project declares none.
 *
 * @example
 * resolveLanguage(["en", "fr"], undefined, "fr"); // → "fr"
 * resolveLanguage(["en", "fr"], "de", null); // → "en"
 */
export function resolveLanguage(
  languages: readonly string[],
  requested: unknown,
  stored: string | null,
): string | undefined {
  // `includes`, not a key lookup: a URL may say "constructor".
  if (typeof requested === "string" && languages.includes(requested))
    return requested;
  if (stored !== null && languages.includes(stored)) return stored;
  return languages[0];
}

/** The reader's last menu pick, or null. Unvalidated: `resolveLanguage` checks it. */
export function readStoredLanguage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredLanguage(language: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage unavailable (private mode, quota) — the URL still carries
    // the choice; it just doesn't follow the reader to a new tab.
  }
}

/**
 * Declares the page language on `<html lang>` so assistive technology reads
 * the text in it (WCAG 2.2 SC 3.1.1, https://www.w3.org/TR/WCAG22/#language-of-page).
 */
export function applyDocumentLanguage(language: string): void {
  document.documentElement.lang = language;
}

/**
 * A language's name in that language, capitalised — what a reader who
 * cannot read the current one looks for. The upper-cased code when the
 * runtime has no name for it.
 *
 * @example
 * languageDisplayName("fr"); // → "Français"
 */
export function languageDisplayName(language: string): string {
  const name = nativeName(language);
  if (name === undefined || name === language) return language.toUpperCase();
  return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
}

function nativeName(language: string): string | undefined {
  try {
    return new Intl.DisplayNames([language], { type: "language" }).of(language);
  } catch {
    // A code Intl rejects as malformed.
    return undefined;
  }
}
