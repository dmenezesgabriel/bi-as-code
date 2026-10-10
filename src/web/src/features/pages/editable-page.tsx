import { lazy, Suspense, type ReactNode } from "react";
import { useSearch } from "@tanstack/react-router";
import { isEditSearch } from "../editor/edit-search";
import type { PageSourcePort } from "../editor/types";

// vite defines `import.meta.hot` only while its dev server serves the module
// and replaces it with `undefined` in every build, so the dynamic import —
// and with it every byte of the editor — never reaches a bundle.
// `import.meta.env.DEV` would not do: it follows NODE_ENV, and a build run
// with NODE_ENV=development shipped the editor chunk.
const LazyPageEditor = import.meta.hot
  ? lazy(async () => ({
      default: (await import("../editor/page-editor")).PageEditor,
    }))
  : null;

type EditablePageProps = {
  /** The page's project-relative file, e.g. "pages/weekly-review.md". */
  file: string;
  /** The dev server's page-source access; absent outside `biac dev`. */
  pageSource?: PageSourcePort;
  /** The rendered page. */
  children: ReactNode;
};

/**
 * Renders the page, or — in dev with `?edit` in the URL — the page inside
 * the split-pane source editor. The flag rides on the page's own URL so
 * filters (`?region=West`) and the route's loader keep working in the
 * editor.
 *
 * @example
 * <EditablePage file={entry.file} pageSource={pageSource}>
 *   <MarkdownPage page={mod} siteTitle={site.title} />
 * </EditablePage>
 */
export function EditablePage({
  file,
  pageSource,
  children,
}: EditablePageProps): ReactNode {
  const editing = isEditSearch(useSearch({ strict: false }));
  if (!editing || !pageSource || !LazyPageEditor) return children;
  return (
    <Suspense fallback={children}>
      <LazyPageEditor file={file} port={pageSource}>
        {children}
      </LazyPageEditor>
    </Suspense>
  );
}
