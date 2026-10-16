import type { ErrorComponentProps } from "@tanstack/react-router";
import { useDocumentTitle } from "./use-document-title";

/**
 * Route error boundary body: a page whose module fails to load or whose MDX
 * component throws gets an in-page error instead of a blank screen. These
 * are runtime failures; a page that does not compile never reaches this
 * boundary — the dev server serves its error as the page's module.
 */
export function PageError({ error }: ErrorComponentProps) {
  useDocumentTitle("Error");
  const message = error instanceof Error ? error.message : String(error);
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">This page failed to render</h1>
      <pre className="mt-4 overflow-x-auto rounded-sm bg-muted p-4 text-sm">
        {message}
      </pre>
    </main>
  );
}
