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
      <div className="h-4 rounded-sm bg-secondary" />
      <div className="h-4 w-5/6 rounded-sm bg-secondary" />
      <div className="h-4 w-4/6 rounded-sm bg-secondary" />
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
      className="rounded-sm border border-destructive-border bg-destructive-surface px-3 py-2 text-sm text-destructive-foreground"
    >
      <code className="font-medium">{name}</code>: {message}
    </p>
  );
}

/** A successful query that returned no rows. */
export function TableEmpty() {
  return <p className="py-2 text-sm text-muted-foreground-faded">0 rows</p>;
}
