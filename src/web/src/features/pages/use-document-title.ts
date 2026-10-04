import { useEffect } from "react";

const DEFAULT_TITLE = "biac";

/**
 * Sets `document.title` to the page's title, falling back to the app name
 * for untitled pages.
 *
 * @example
 * useDocumentTitle(page.title); // "Quarterly results" → document.title
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ?? DEFAULT_TITLE;
  }, [title]);
}
