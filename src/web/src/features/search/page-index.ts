import MiniSearch from "minisearch";
import type { PageIndex, PageSearchDocument, PageSearchResult } from "./types";

// Observable Framework's site-search numbers
// (https://observablehq.com/framework/search): a match in the title or
// keywords counts four times one in the text, a term may be 15% of its
// length off, and a typed term matches longer words it begins.
const QUERY_OPTIONS = {
  boost: { title: 4, keywords: 4 },
  fuzzy: 0.15,
  prefix: true,
};

/**
 * Indexes the pages' title, text and keywords for site search; the one
 * place MiniSearch is used, so indexing and querying share their options.
 *
 * @example
 * buildPageIndex(documents).search("fulfil");
 * // → [{ id: "/nested/allocation", title: "Allocation" }]
 */
export function buildPageIndex(
  documents: readonly PageSearchDocument[],
): PageIndex {
  const index = new MiniSearch<PageSearchDocument>({
    fields: ["title", "text", "keywords"],
    storeFields: ["title"],
    processTerm: searchTerm,
  });
  index.addAll(documents);
  return {
    search: (query) => index.search(query, QUERY_OPTIONS).map(toResult),
  };
}

function toResult(match: { id: unknown; title?: unknown }): PageSearchResult {
  return { id: String(match.id), title: String(match.title) };
}

/**
 * A term as indexed and queried: accents folded, lower-cased and cut to 15
 * characters, which keeps the index small; a term with more than six
 * digits (an id, a phone number) is dropped as noise.
 */
function searchTerm(term: string): string | null {
  const folded = term.normalize("NFD").replace(/\p{M}/gu, "");
  if ((folded.match(/\p{N}/gu)?.length ?? 0) > 6) return null;
  return folded.slice(0, 15).toLowerCase();
}
