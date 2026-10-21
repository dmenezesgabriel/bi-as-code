import { LANGUAGE_SEARCH_KEY } from "../chrome/language";
import { EDITOR_SEARCH_KEY } from "../editor/edit-search";

/**
 * The URL search keys the app itself owns, each with what it does. A page
 * filter persists its value under its id as a search key, so a filter named
 * with one would drive it.
 */
const RESERVED_SEARCH_KEYS: ReadonlyMap<string, string> = new Map([
  [EDITOR_SEARCH_KEY, "opens the source editor in biac dev"],
  [LANGUAGE_SEARCH_KEY, "chooses the page language"],
]);

/**
 * Fails a page filter named with a search key the app owns. Literal ids
 * are rejected at compile time (`src/engine/reserved-filter-id.ts`); this
 * catches an id computed by an expression, which the compiler cannot read.
 *
 * @example
 * assertNotReservedSearchKey("region"); // passes
 * assertNotReservedSearchKey("lang"); // throws: Reserved filter id "lang" — …
 */
export function assertNotReservedSearchKey(filterId: string): void {
  const owner = RESERVED_SEARCH_KEYS.get(filterId);
  if (owner === undefined) return;
  throw new Error(
    `Reserved filter id "${filterId}" — "${filterId}" ${owner}; choose another id`,
  );
}
