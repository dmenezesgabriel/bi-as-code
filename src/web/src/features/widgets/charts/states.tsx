import type { ReactElement, ReactNode } from "react";
import type { Row } from "../../data/types";
import type { QueryResult } from "../../pages/types";
import { ColumnError, FormatError } from "../value/types";

/**
 * The non-success faces of a series chart, each sized to the chart's
 * `height` so a loading, failed or filtered-empty chart reserves the same
 * page space its canvas would. Unlike the value family's inline spans these
 * are block boxes — charts are block-level MDX content.
 */

/** Skeleton pulse at the chart's height while a query is in flight. */
export function ChartLoading({ height }: { height: number }): ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading query result"
      className="w-full animate-pulse rounded bg-secondary"
      style={{ height }}
    />
  );
}

/**
 * Block failure naming the query that produced it — a bad `data` ref, a
 * `ColumnError`/`FormatError` from the option build, or a query error must
 * not take down the page around it.
 */
export function ChartError({
  name,
  message,
  height,
}: {
  name: string;
  message: string;
  height: number;
}): ReactElement {
  return (
    <div className="w-full" style={{ height }}>
      <p
        role="alert"
        className="rounded border border-destructive-border bg-destructive-surface px-3 py-2 text-sm text-destructive-foreground"
      >
        <code className="font-medium">{name}</code>: {message}
      </p>
    </div>
  );
}

/** A successful query that returned no rows — e.g. a filtered-empty fence. */
export function ChartEmpty({ height }: { height: number }): ReactElement {
  return (
    <div
      data-chart-empty
      className="flex w-full items-center justify-center"
      style={{ height }}
    >
      <p className="text-sm text-muted-foreground-faded">0 rows</p>
    </div>
  );
}

/**
 * The `QueryResult` switch for the series-chart family: an unknown `data`
 * name, an in-flight query and a failed one each render their face at the
 * chart's height; a success hands `rows` to the widget's projection.
 * `ColumnError`/`FormatError` thrown while projecting surface as
 * `ChartError` — typed errors are author-facing — while anything
 * unexpected rethrows.
 */
export function ChartResult({
  name,
  result,
  height,
  children,
}: {
  name: string;
  result: QueryResult | undefined;
  height: number;
  children: (rows: readonly Row[]) => ReactNode;
}): ReactElement {
  if (result === undefined) {
    return (
      <ChartError
        name={name}
        message="no sql fence on this page declares this name"
        height={height}
      />
    );
  }
  if (result.status === "loading") return <ChartLoading height={height} />;
  if (result.status === "error") {
    return <ChartError name={name} message={result.message} height={height} />;
  }
  try {
    return <>{children(result.rows)}</>;
  } catch (error) {
    if (error instanceof ColumnError || error instanceof FormatError) {
      return <ChartError name={name} message={error.message} height={height} />;
    }
    throw error;
  }
}
