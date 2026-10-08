import type {
  ClauseMetadata,
  ClauseSource,
  FilterPredicate,
  IntervalExtent,
  QueryClient,
  SelectionClause,
} from "./types";

/** Source and skip-clients shared by every clause constructor. */
interface ClauseOptions {
  source: ClauseSource;
  /** Clients this clause skips under cross-filtering (the port of mosaic's per-clause `clients`). */
  clients?: ReadonlySet<QueryClient>;
}

/**
 * A clause for one selected point value: `field = ?`.
 * A nullish value contributes no predicate — our filter values treat null
 * as cleared, where mosaic builds a NULL literal.
 *
 * @example
 * clausePoint("region", "West", { source: filter });
 * // → { meta: {type: "point"}, predicate: {sql: "region = ?", params: ["West"]}, … }
 */
export function clausePoint(
  field: string,
  value: unknown,
  { source, clients }: ClauseOptions,
): SelectionClause {
  return {
    meta: { type: "point" },
    source,
    clients,
    fields: [field],
    value,
    predicate: value == null ? null : { sql: `${field} = ?`, params: [value] },
  };
}

/**
 * A clause for multiple selected values: `field IN (?, …)`. An empty array
 * or undefined value contributes no predicate — an empty list clears, it
 * never filters every row out.
 *
 * @example
 * clauseList("region", ["West", "North"], { source: filter });
 */
export function clauseList(
  field: string,
  value: readonly unknown[] | undefined,
  { source, clients }: ClauseOptions,
): SelectionClause {
  const predicate: FilterPredicate | null =
    !value || value.length === 0
      ? null
      : {
          sql: `${field} IN (${value.map(() => "?").join(", ")})`,
          params: [...value],
        };
  return {
    meta: { type: "list" },
    source,
    clients,
    fields: [field],
    value,
    predicate,
  };
}

/**
 * A clause for a selected interval: `BETWEEN` closed, `>=`/`<=` open-ended
 * (mosaic's clause is strictly `isBetween([lo, hi])`; our Slider and
 * DateRange publish half-open states). A fully open or absent extent
 * contributes no predicate.
 *
 * @example
 * clauseInterval("amount", [10, 20], { source: filter });
 */
export function clauseInterval(
  field: string,
  extent: IntervalExtent | null | undefined,
  { source, clients }: ClauseOptions,
): SelectionClause {
  const [lo, hi] = extent ?? [];
  let predicate: FilterPredicate | null = null;
  if (lo !== undefined && hi !== undefined) {
    predicate = { sql: `${field} BETWEEN ? AND ?`, params: [lo, hi] };
  } else if (lo !== undefined) {
    predicate = { sql: `${field} >= ?`, params: [lo] };
  } else if (hi !== undefined) {
    predicate = { sql: `${field} <= ?`, params: [hi] };
  }
  return {
    meta: { type: "interval" },
    source,
    clients,
    fields: [field],
    value: extent,
    predicate,
  };
}

const MATCH_METHODS = {
  contains: "contains",
  prefix: "prefix",
  suffix: "suffix",
  regexp: "regexp_matches",
} as const;

export type MatchMethod = keyof typeof MATCH_METHODS;

interface MatchMetadata extends ClauseMetadata {
  readonly type: "match";
  readonly method: MatchMethod;
}

export interface MatchOptions extends ClauseOptions {
  /** The text matching method, default `'contains'`. */
  method?: MatchMethod;
  /** Case-sensitive matching, default `false` (both sides lowered). */
  caseSensitive?: boolean;
}

/**
 * A clause for text search matching over one column, case-insensitive by
 * default; the value travels as a bound param, lowered in SQL. A falsy
 * value contributes no predicate.
 *
 * @example
 * clauseMatch("region", "west", { source: filter });
 * // → predicate {sql: "contains(lower(region), lower(?))", params: ["west"]}
 */
export function clauseMatch(
  field: string,
  value: string | null | undefined,
  { source, clients, method = "contains", caseSensitive = false }: MatchOptions,
): SelectionClause {
  const fn = MATCH_METHODS[method];
  const fieldExpr = caseSensitive ? field : `lower(${field})`;
  const valueExpr = caseSensitive ? "?" : "lower(?)";
  const meta: MatchMetadata = { type: "match", method };
  return {
    meta,
    source,
    clients,
    fields: [field],
    value,
    predicate: value
      ? { sql: `${fn}(${fieldExpr}, ${valueExpr})`, params: [value] }
      : null,
  };
}

/**
 * The empty clause: a null predicate whose only job is clearing its
 * source's clause on resolve.
 *
 * @example
 * selection.update(clauseNone(filter)); // clears the filter's clause
 */
export function clauseNone(source: ClauseSource): SelectionClause {
  return { source, fields: [], value: null, predicate: null };
}

const compose = (
  joiner: "AND" | "OR",
  predicates: readonly FilterPredicate[],
): FilterPredicate | undefined => {
  if (predicates.length === 0) return undefined;
  if (predicates.length === 1) return predicates[0];
  return {
    sql: predicates.map((p) => `(${p.sql})`).join(` ${joiner} `),
    params: predicates.flatMap((p) => [...p.params]),
  };
};

/**
 * Conjoin fragments; each is parenthesized so a fragment carrying its own
 * OR cannot leak into the join. A lone fragment passes through unwrapped,
 * an empty list contributes nothing.
 *
 * @example
 * composeAnd([{sql: "region = ?", params: ["West"]}, {sql: "amount >= ?", params: [10]}]);
 * // → {sql: "(region = ?) AND (amount >= ?)", params: ["West", 10]}
 */
export const composeAnd = (
  predicates: readonly FilterPredicate[],
): FilterPredicate | undefined => compose("AND", predicates);

/**
 * Disjoin fragments under the same parenthesization rule as `composeAnd`.
 *
 * @example
 * composeOr([{sql: "region = ?", params: ["West"]}, {sql: "region = ?", params: ["East"]}]);
 * // → {sql: "(region = ?) OR (region = ?)", params: ["West", "East"]}
 */
export const composeOr = (
  predicates: readonly FilterPredicate[],
): FilterPredicate | undefined => compose("OR", predicates);
