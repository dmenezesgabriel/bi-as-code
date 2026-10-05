import { isValidElement, type HTMLAttributes, type ReactNode } from "react";
import { DataTable } from "../widgets/table/data-table";
import { TableError, TableLoading } from "../widgets/table/states";
import { HighlightedPre } from "./highlighted-pre";
import { useQueryResults } from "./query-registry";
import type { QueryResult } from "./types";

/**
 * `pre` override for the MDX component map. A named ` ```sql ` fence
 * arrives as `<code className="language-sql" meta="name">` — compile-page
 * emits `meta` from the fence info string — so the block's `QueryResult`
 * is looked up by name and rendered under the highlighted code: skeleton
 * while loading, an inline error on failure, the rows as a sortable,
 * paginated table on success. Anything else (unnamed sql, other
 * languages, no registry, unknown name) stays code-only through
 * `HighlightedPre`.
 */
export function SqlBlockPre(props: HTMLAttributes<HTMLPreElement>) {
  const name = sqlFenceName(props.children);
  const results = useQueryResults();
  const result = name === null ? undefined : results[name];
  if (name === null || result === undefined) {
    return <HighlightedPre {...props} />;
  }
  return (
    <>
      <HighlightedPre {...props} />
      <SqlResult name={name} result={result} />
    </>
  );
}

/**
 * The query name carried by a sql fence's code child — the `meta` prop
 * compile-page emits for named blocks — or null when the fence is not a
 * named sql block.
 */
function sqlFenceName(children: ReactNode): string | null {
  if (!isValidElement(children)) return null;
  const { className, meta } = children.props as {
    className?: string;
    meta?: unknown;
  };
  if (className !== "language-sql" || typeof meta !== "string") return null;
  return meta === "" ? null : meta;
}

// A fence result is the same table the `<Table>` widget renders — one
// presentational core, so sort and pagination behave identically at both
// call sites.
function SqlResult({ name, result }: { name: string; result: QueryResult }) {
  if (result.status === "loading") return <TableLoading />;
  if (result.status === "error") {
    return <TableError name={name} message={result.message} />;
  }
  return <DataTable rows={result.rows} />;
}
