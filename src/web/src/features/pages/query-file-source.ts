import type { QueryResult } from "./types";

// The engine names a query file's block by its root path; a page fence's
// name never starts with "/".
const QUERIES_PREFIX = "/queries/";

/**
 * `result`, with an error prefixed by the query file the block runs —
 * `/queries/sales/totals` → `queries/sales/totals.sql: …` — so a widget
 * reading a file says which file to fix. A page fence's error stays as the
 * warehouse wrote it, even when the fence builds on a file: DuckDB reports
 * only a position in the combined SQL, so it cannot tell a broken file from
 * a broken fence, and naming the file would be a guess. Its `LINE` excerpt
 * already quotes the text that failed.
 *
 * @example
 * attributedToQueryFile("/queries/totals", { status: "error", message: "Parser Error: …" });
 * // → { status: "error", message: "queries/totals.sql: Parser Error: …" }
 */
export function attributedToQueryFile(
  name: string,
  result: QueryResult,
): QueryResult {
  if (result.status !== "error" || !name.startsWith(QUERIES_PREFIX)) {
    return result;
  }
  return {
    status: "error",
    message: `${name.slice(1)}.sql: ${result.message}`,
  };
}
