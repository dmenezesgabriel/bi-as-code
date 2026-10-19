import { clauseMatch } from "../../crossfilter/clause";
import type { ClauseOptions } from "../../crossfilter/types";
import type { FilterOptions } from "../../filters/filter";
import type { SearchMethod } from "./types";

/**
 * The `<Search>` clause factory — mosaic's `Search` input publishing
 * `clauseMatch(field, value, {method})`: a case-insensitive match of the
 * held text against the filter's column, and an empty or cleared text
 * contributes no predicate.
 *
 * @example
 * usePageFilter<string>("q", { column: "region", clause: searchClause("prefix") });
 */
export function searchClause(
  method: SearchMethod,
): NonNullable<FilterOptions<string>["clause"]> {
  return (column: string, value: string | undefined, ctx: ClauseOptions) =>
    clauseMatch(column, value, { ...ctx, method });
}
