/**
 * The `filters` widget prop's authoring shape: MDX authors write a lone id
 * (`filters="region"`) or a list (`filters={["region", "channel"]}`).
 */
export type FilterIds = string | readonly string[];

/**
 * The hook-shaped id list: an absent prop contributes none, a lone string
 * is a one-element list, a list passes through.
 *
 * @example
 * toFilterIds("region"); // ["region"]
 */
export function toFilterIds(filters: FilterIds | undefined): readonly string[] {
  if (filters === undefined) return [];
  return typeof filters === "string" ? [filters] : filters;
}
