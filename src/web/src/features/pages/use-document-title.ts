import { useEffect } from "react";

const DEFAULT_TITLE = "biac";

/**
 * Sets `document.title` to the page's title, falling back to the site name
 * from `biac.config.ts` for untitled pages.
 *
 * @example
 * useDocumentTitle(page.title, site.title); // "Quarterly results" → document.title
 */
export function useDocumentTitle(
  title: string | null,
  siteTitle: string = DEFAULT_TITLE,
): void {
  useEffect(() => {
    document.title = title ?? siteTitle;
  }, [title, siteTitle]);
}
