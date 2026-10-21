import { assertNotReservedSearchKey } from "./reserved-search-keys";

/**
 * The `filters` widget prop's authoring shape: MDX authors write a lone id
 * (`filters="region"`) or a list (`filters={["region", "channel"]}`).
 */
export type FilterIds = string | readonly string[];

/**
 * The hook-shaped id list: an absent prop contributes none, a lone string
 * is a one-element list, a list passes through. Throws on a URL key the
 * app owns (`edit`, `lang`), which a page filter must not take.
 *
 * @example
 * toFilterIds("region"); // ["region"]
 */
export function toFilterIds(filters: FilterIds | undefined): readonly string[] {
  if (filters === undefined) return [];
  const ids = typeof filters === "string" ? [filters] : filters;
  ids.forEach(assertNotReservedSearchKey);
  return ids;
}
