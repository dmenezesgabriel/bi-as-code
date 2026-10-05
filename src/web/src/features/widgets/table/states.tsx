/**
 * The non-success faces of a query result, shared by the `<Table>` widget
 * and the named ` ```sql ` fence's inline result so both render identical
 * loading, error and empty chrome.
 */

/** Skeleton pulse while a query is in flight. */
export function TableLoading() {
  return (
    <div
      role="status"
      aria-label="Loading query result"
      className="animate-pulse space-y-1.5 py-2"
    >
      <div className="h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="h-4 w-5/6 rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="h-4 w-4/6 rounded bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}

/**
 * Inline failure naming the query that produced it — a bad `data` ref or a
 * query error must not take down the page around it.
 */
export function TableError({
  name,
  message,
}: {
  name: string;
  message: string;
}) {
  return (
    <p
      role="alert"
      className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      <code className="font-medium">{name}</code>: {message}
    </p>
  );
}

/** A successful query that returned no rows. */
export function TableEmpty() {
  return <p className="py-2 text-sm text-neutral-500">0 rows</p>;
}
