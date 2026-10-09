import type { Row } from "../data/types";
import type { InterpolatedQuery } from "../pages/interpolate";
import type { QueryResult } from "../pages/types";

/**
 * A predicate bound for a prepared statement: `sql` carries `?` holes.
 */
export interface FilterPredicate {
  readonly sql: string;
  readonly params: readonly unknown[];
}

/**
 * Object identity keys clause resolution and cross-filter skip — the port
 * of mosaic's `ClauseSource`: a page's `Filter` instance for named filters,
 * a chart client for published selections.
 */
export type ClauseSource = object;

/** The clause vocabulary every widget speaks (ADR-0004). */
export type ClauseType = "point" | "list" | "interval" | "match";

export interface ClauseMetadata {
  readonly type: ClauseType;
}

/** An interval extent; an `undefined` member is an open end. */
export type IntervalExtent = readonly [lo: unknown, hi: unknown];

export interface SelectionClause {
  readonly source: ClauseSource;
  /** Clients this clause skips when it applies under cross-filtering. */
  readonly clients?: ReadonlySet<QueryClient>;
  /** The columns the predicate filters over. */
  readonly fields: readonly string[];
  readonly value: unknown;
  /** The bound WHERE fragment; `null` clears its source's clause. */
  readonly predicate: FilterPredicate | null;
  readonly meta?: ClauseMetadata;
}

/**
 * A coordinator-registered data consumer, the port of mosaic's
 * `MosaicClient` contract: the coordinator resolves the predicate for this
 * client, runs the query it builds, and drives its lifecycle callbacks.
 *
 * @example
 * const client: QueryClient = {
 *   query: (predicate) => wrapBlock(block, predicate),
 *   queryPending: () => setState({ status: "loading" }),
 *   queryResult: (rows) => setState({ status: "success", rows }),
 *   queryError: (message) => setState({ status: "error", message }),
 * };
 */
export interface QueryClient {
  /** The wrapped query to run under the given predicate; `undefined` = nothing to run. */
  query(predicate: FilterPredicate): InterpolatedQuery | undefined;
  queryPending(): void;
  queryResult(rows: readonly Row[]): void;
  queryError(message: string): void;
}

/**
 * Runs one wrapped query to completion — the data boundary the coordinator
 * hands each client's query to; the bridge binds it to the page's runtime
 * and registered block (`runBlock`).
 */
export type QueryRunner = (
  query: InterpolatedQuery,
  signal: AbortSignal,
) => Promise<QueryResult>;
