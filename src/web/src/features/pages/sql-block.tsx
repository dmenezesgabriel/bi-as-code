import { isValidElement, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { Row } from "../data/types";
import { HighlightedPre } from "./highlighted-pre";
import { useQueryResults } from "./query-registry";
import type { QueryResult } from "./types";

/**
 * `pre` override for the MDX component map. A named ` ```sql ` fence
 * arrives as `<code className="language-sql" meta="name">` — compile-page
 * emits `meta` from the fence info string — so the block's `QueryResult`
 * is looked up by name and rendered under the highlighted code: skeleton
 * while loading, an inline error on failure, the rows as a table on
 * success. Anything else (unnamed sql, other languages, no registry,
 * unknown name) stays code-only through `HighlightedPre`.
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

function SqlResult({ name, result }: { name: string; result: QueryResult }) {
  if (result.status === "loading") return <LoadingRows />;
  if (result.status === "error") {
    return (
      <p
        role="alert"
        className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      >
        <code className="font-medium">{name}</code>: {result.message}
      </p>
    );
  }
  if (result.rows.length === 0) {
    return <p className="py-2 text-sm text-neutral-500">0 rows</p>;
  }
  return <ResultTable rows={result.rows} />;
}

function LoadingRows() {
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

function ResultTable({ rows }: { rows: readonly Row[] }) {
  const columns = Object.keys(rows[0] ?? {});
  return (
    <div className="overflow-x-auto py-2">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="border-b border-neutral-300 py-1 pr-4 text-left font-medium dark:border-neutral-700"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // A sql result row has no stable id and may duplicate another
            // row byte-for-byte, so position is its identity — the result
            // set re-renders wholesale on every new QueryResult.
            // eslint-disable-next-line react-doctor/no-array-index-as-key
            <tr key={index}>
              {columns.map((column) => {
                const value = row[column];
                return (
                  <td
                    key={column}
                    className={cn(
                      "border-b border-neutral-200 py-1 pr-4 dark:border-neutral-800",
                      typeof value === "number" && "text-right",
                    )}
                  >
                    {value == null ? "" : String(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
