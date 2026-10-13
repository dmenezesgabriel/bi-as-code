/**
 * The URL search key the source editor owns in `biac dev` (ADR-0010).
 * Matched exactly: router search keys are case-sensitive, so `?Edit` is an
 * ordinary page parameter.
 */
const EDITOR_SEARCH_KEY = "edit";

/**
 * True when a page URL's parsed search asks for the source editor. Any
 * `edit` value but `false` counts: the router parses a bare `?edit` to `""`
 * and the Edit link writes `?edit=true`.
 *
 * @example
 * isEditSearch({ region: "West", edit: true }); // → true
 * isEditSearch({ edit: false }); // → false
 */
export function isEditSearch(
  search: Readonly<Record<string, unknown>>,
): boolean {
  const flag = search[EDITOR_SEARCH_KEY];
  return flag !== undefined && flag !== false;
}

/**
 * A page URL's parsed search as the page's own code may see it: the editor's
 * key is not a page parameter, whatever its value. A search that never held
 * the key comes back as the same object, so callers keying on identity see
 * no change.
 *
 * @example
 * searchWithoutEditorKey({ region: "West", edit: true }); // → { region: "West" }
 */
export function searchWithoutEditorKey(
  search: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  if (!(EDITOR_SEARCH_KEY in search)) return search;
  return Object.fromEntries(
    Object.entries(search).filter(([key]) => key !== EDITOR_SEARCH_KEY),
  );
}
