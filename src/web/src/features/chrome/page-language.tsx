import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * The resolved page language as a tree value. `useLanguage` in the shell
 * decides it once; the routed page reads it here to pick its translations,
 * so the header menu and the page can never disagree. Undefined for
 * provider-less mounts (stories, tests) and projects with no
 * `translations.yaml` — a page then renders the first declared language.
 */
const PageLanguageContext = createContext<string | undefined>(undefined);

/**
 * @example
 * <PageLanguageProvider language={language}>{children}</PageLanguageProvider>
 */
export function PageLanguageProvider({
  language,
  children,
}: {
  language: string | undefined;
  children: ReactNode;
}): ReactElement {
  return (
    <PageLanguageContext.Provider value={language}>
      {children}
    </PageLanguageContext.Provider>
  );
}

/** The language the routed page renders its translations in. */
export function usePageLanguage(): string | undefined {
  return useContext(PageLanguageContext);
}
