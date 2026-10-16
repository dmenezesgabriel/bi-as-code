import type { ReactElement, ReactNode } from "react";
import type { Row } from "../../data/types";
import type { QueryResult } from "../../pages/types";
import { ColumnError, FormatError } from "./types";

/**
 * The non-success faces of a named ```sql result for the value-widget
 * family — `<Value>`/`<Delta>`/`<Sparkline>`/`<BigValue>` all render these.
 * Unlike the table's block-level states these are `<span>` trees, so a
 * widget sitting inside prose keeps the MDX `<p>` wrapper valid HTML.
 */

/** Skeleton pulse at text size while a query is in flight. */
export function ValueLoading(): ReactElement {
  return (
    <span
      role="status"
      aria-label="Loading query result"
      className="inline-block h-4 w-16 animate-pulse rounded-sm bg-secondary align-middle"
    />
  );
}

/**
 * Inline failure naming the query that produced it — a bad `data`/`column`/
 * `fmt` ref or a query error must not take down the prose around it.
 */
export function ValueError({
  name,
  message,
}: {
  name: string;
  message: string;
}): ReactElement {
  return (
    <span
      role="alert"
      className="rounded-sm border border-destructive-border bg-destructive-surface px-1.5 py-0.5 text-sm text-destructive-foreground"
    >
      <code className="font-medium">{name}</code>: {message}
    </span>
  );
}

/**
 * The `QueryResult` switch for the value widgets: an unknown `data` name,
 * an in-flight query and a failed one each render their face; a success
 * hands `rows` to the widget's projection. `ColumnError`/`FormatError`
 * thrown while projecting surface as `ValueError` — typed errors are
 * author-facing — while anything unexpected rethrows.
 */
export function ValueResult({
  name,
  result,
  children,
}: {
  name: string;
  result: QueryResult | undefined;
  children: (rows: readonly Row[]) => ReactNode;
}): ReactElement {
  if (result === undefined) {
    return (
      <ValueError
        name={name}
        message="no sql fence on this page declares this name"
      />
    );
  }
  if (result.status === "loading") return <ValueLoading />;
  if (result.status === "error") {
    return <ValueError name={name} message={result.message} />;
  }
  try {
    return <>{children(result.rows)}</>;
  } catch (error) {
    if (error instanceof ColumnError || error instanceof FormatError) {
      return <ValueError name={name} message={error.message} />;
    }
    throw error;
  }
}
