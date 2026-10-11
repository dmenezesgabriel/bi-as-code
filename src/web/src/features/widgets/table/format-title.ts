/** Words a header keeps upper-case: identifiers and period comparisons. */
const ACRONYMS = new Set([
  "id",
  "usd",
  "wow",
  "yoy",
  "mom",
  "qoq",
  "roi",
  "kpi",
]);

/** Joining words a header keeps lower-case anywhere but first. */
const JOINERS = new Set(["of", "the", "and", "in", "on"]);

/**
 * The header a result column shows: a snake_case or expression name reads
 * as title-cased words (`_` → space, `f(x)` → `F of X`, acronyms upper,
 * joiners lower). A name with a capital or a space is an author's SQL
 * alias (`as "Revenue (USD)"`) and is kept as written.
 *
 * @example
 * formatTitle("pct_of_total") // "Pct of Total"
 * formatTitle("order_id") // "Order ID"
 */
export function formatTitle(column: string): string {
  if (/[A-Z\s]/.test(column)) return column;
  const words = column
    .replaceAll('"', "")
    .replaceAll("(", " of ")
    .split(/[_\s)]+/)
    .filter((word) => word !== "");
  return words.map((word, index) => titleWord(word, index === 0)).join(" ");
}

function titleWord(word: string, first: boolean): string {
  if (ACRONYMS.has(word)) return word.toUpperCase();
  if (JOINERS.has(word) && !first) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}
