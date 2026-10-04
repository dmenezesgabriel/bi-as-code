import { Link } from "@tanstack/react-router";
import { useDocumentTitle } from "./use-document-title";

export function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        This route does not match any page in <code>pages/</code>.
      </p>
      <p className="mt-4">
        <Link to="/" className="text-blue-600 underline dark:text-blue-400">
          Back to index
        </Link>
      </p>
    </main>
  );
}
