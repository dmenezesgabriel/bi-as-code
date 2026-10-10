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
  return search.edit !== undefined && search.edit !== false;
}
