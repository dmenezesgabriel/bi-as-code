import { isValidElement, type HTMLAttributes, type ReactNode } from "react";
import { DataTable } from "../widgets/table/data-table";
import { TableError, TableLoading } from "../widgets/table/states";
import { HighlightedPre } from "./highlighted-pre";
import { useQueryResults } from "./query-registry";
import type { QueryResult } from "./types";

/** A named sql fence as compile-page emits it on the code element. */
type SqlFence = { name: string; echo: boolean; display: boolean };

/**
 * `pre` override for the MDX component map. A named ` ```sql ` fence
 * arrives as `<code className="language-sql" meta="name">` — compile-page
 * emits `meta` from the fence info string, plus an empty-string `echo` /
 * `display` prop for each flag the fence turns on. A named block shows
 * nothing by default: `echo` adds its highlighted code, `display` its
 * result (skeleton while loading, the rows as a sortable, paginated
 * table). A failed query shows its inline error either way, so hiding a
 * block never hides a failure. Anything else (unnamed sql, other
 * languages) stays code-only through `HighlightedPre`.
 *
 * @example
 * <MDXProvider components={{ pre: SqlBlockPre }}>…</MDXProvider>
 */
export function SqlBlockPre(props: HTMLAttributes<HTMLPreElement>) {
  const fence = sqlFenceOf(props.children);
  const results = useQueryResults();
  if (fence === null) return <HighlightedPre {...props} />;
  const result = results[fence.name];
  return (
    <>
      {fence.echo && <HighlightedPre {...props} />}
      {result !== undefined && (
        <SqlResult name={fence.name} display={fence.display} result={result} />
      )}
    </>
  );
}

/**
 * The named sql block carried by a fence's code child — its `meta` name
 * and which display flags are present — or null when the fence is not a
 * named sql block.
 */
function sqlFenceOf(children: ReactNode): SqlFence | null {
  if (!isValidElement(children)) return null;
  const { className, meta, echo, display } = children.props as {
    className?: string;
    meta?: unknown;
    echo?: unknown;
    display?: unknown;
  };
  if (className !== "language-sql" || typeof meta !== "string") return null;
  if (meta === "") return null;
  return {
    name: meta,
    echo: echo !== undefined,
    display: display !== undefined,
  };
}

// A fence result is the same table the `<Table>` widget renders — one
// presentational core, so sort and pagination behave identically at both
// call sites.
function SqlResult({
  name,
  display,
  result,
}: {
  name: string;
  display: boolean;
  result: QueryResult;
}) {
  if (result.status === "error") {
    return <TableError name={name} message={result.message} />;
  }
  if (!display) return null;
  if (result.status === "loading") return <TableLoading />;
  return <DataTable rows={result.rows} downloadName={name} />;
}
