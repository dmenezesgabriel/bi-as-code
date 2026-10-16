import type { PageCompileError } from "./types";
import { useDocumentTitle } from "./use-document-title";

type CompileErrorPageProps = {
  /** Why the page did not compile, as the dev server reported it. */
  error: PageCompileError;
};

/**
 * Stands in for a page that failed to compile: the file, the position when
 * the compiler gave one, and its message. It renders where the page would,
 * so an author editing the page keeps the app — and the source editor —
 * around the error. Announced as an alert because it replaces the page the
 * moment a broken edit is saved.
 *
 * @example
 * <CompileErrorPage
 *   error={{ file: "pages/a.md", message: "Unexpected `<`", line: 7, column: 1 }}
 * />
 */
export function CompileErrorPage({ error }: CompileErrorPageProps) {
  useDocumentTitle("Error");
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div role="alert">
        <h1 className="text-2xl font-semibold">This page failed to compile</h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {errorLocation(error)}
        </p>
        <pre className="mt-4 rounded-sm bg-muted p-4 text-sm break-words whitespace-pre-wrap">
          {error.message}
        </pre>
      </div>
    </main>
  );
}

function errorLocation({ file, line, column }: PageCompileError): string {
  if (line === undefined || column === undefined) return file;
  return `${file}:${line}:${column}`;
}
