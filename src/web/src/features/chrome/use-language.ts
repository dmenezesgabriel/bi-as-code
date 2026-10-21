import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  applyDocumentLanguage,
  LANGUAGE_SEARCH_KEY,
  readStoredLanguage,
  resolveLanguage,
  writeStoredLanguage,
} from "./language";

type PageSearch = Record<string, unknown>;

/**
 * The page language among the project's declared `languages`, plus the
 * reader's pick. A pick is stored for new tabs and written to the URL's
 * `lang` (replacing the entry, other search keys kept) so the address
 * shares the language it shows. The language is declared on `<html lang>`;
 * with no declared language it stays undefined and `<html lang>` is left
 * as `index.html` set it.
 *
 * @example
 * const { language, choose } = useLanguage(["en", "fr"]);
 * <LanguageMenu languages={languages} language={language} onChoose={choose} />
 */
export function useLanguage(languages: readonly string[]): {
  language: string | undefined;
  choose: (language: string) => void;
} {
  const requested = useSearch({ strict: false })[LANGUAGE_SEARCH_KEY];
  const [stored, setStored] = useState<string | null>(readStoredLanguage);
  const navigate = useNavigate();
  const language = resolveLanguage(languages, requested, stored);

  useEffect(() => {
    if (language !== undefined) applyDocumentLanguage(language);
  }, [language]);

  function choose(next: string) {
    setStored(next);
    writeStoredLanguage(next);
    void navigate({
      to: ".",
      search: (prev: PageSearch) => ({ ...prev, [LANGUAGE_SEARCH_KEY]: next }),
      replace: true,
    });
  }

  return { language, choose };
}
