import { composeAnd, composeOr } from "./clause";
import type {
  ClauseSource,
  FilterPredicate,
  QueryClient,
  SelectionClause,
} from "./types";

export interface SelectionOptions {
  /** Skip clauses on the clients that published them (cross-filtering). */
  cross?: boolean;
  /** No clauses means no records instead of no filter. */
  empty?: boolean;
  /** Disjunction strategy; the default is conjunction. */
  union?: boolean;
  /** Keep only the most recent clause; the default accumulates one per source. */
  single?: boolean;
  /** Upstream selections whose clauses and resets relay into this one. */
  include?: Selection[];
}

/** A clause-like marker carrying only a source, used by `remove`. */
const sourceMarker = (source: ClauseSource): SelectionClause => ({
  source,
  fields: [],
  value: undefined,
  predicate: null,
});

const resetSource = (source: ClauseSource) => {
  (source as { reset?: () => void }).reset?.();
};

/**
 * A dynamic set of selection clauses resolved into one query predicate —
 * the port of mosaic's `Selection`/`SelectionResolver` over bound
 * fragments (ADR-0004): clauses replace by source identity, a null
 * predicate clears its source, and `cross` skips a clause on the clients
 * that published it.
 *
 * @example
 * const selection = Selection.crossfilter();
 * selection.update(clausePoint("region", "West", { source: filter }));
 * const predicate = selection.predicate(client); // undefined for the publisher
 */
export class Selection {
  readonly #cross: boolean;
  readonly #empty: boolean;
  readonly #union: boolean;
  readonly #single: boolean;
  #clauses: SelectionClause[] = [];
  #active: SelectionClause | undefined;
  readonly #relay = new Set<Selection>();
  readonly #listeners = new Set<() => void>();

  constructor({
    cross = false,
    empty = false,
    union = false,
    single = false,
    include = [],
  }: SelectionOptions = {}) {
    this.#cross = cross;
    this.#empty = empty;
    this.#union = union;
    this.#single = single;
    for (const upstream of include) upstream.#relay.add(this);
  }

  /** Conjunction strategy: every clause filters every client. */
  static intersect(options: SelectionOptions = {}): Selection {
    return new Selection(options);
  }

  /** Disjunction strategy: clauses compose as an OR. */
  static union(options: SelectionOptions = {}): Selection {
    return new Selection({ ...options, union: true });
  }

  /** Singular strategy: only the most recent clause survives. */
  static single(options: SelectionOptions = {}): Selection {
    return new Selection({ ...options, single: true });
  }

  /** Cross-filtered conjunction: clauses skip their publishing clients. */
  static crossfilter(options: Omit<SelectionOptions, "cross"> = {}): Selection {
    return new Selection({ ...options, cross: true });
  }

  /** Current clauses, one per surviving source. */
  get clauses(): readonly SelectionClause[] {
    return this.#clauses;
  }

  /** The most recently updated clause, if any. */
  get active(): SelectionClause | undefined {
    return this.#active;
  }

  /**
   * Add or replace a clause; a null predicate clears its source's clause.
   * Relays to downstream selections that include this one.
   *
   * @example
   * selection.update(clausePoint("region", "West", { source: filter }));
   */
  update(clause: SelectionClause): this {
    this.#clauses = this.#resolve(this.#clauses, clause, true);
    this.#active = clause;
    for (const downstream of this.#relay) downstream.update(clause);
    this.#notify();
    return this;
  }

  /**
   * A clone of this selection without the source's clauses; the original
   * is untouched and the clone's active clause marks the removal.
   *
   * @example
   * const unfiltered = selection.remove(filter);
   */
  remove(source: ClauseSource): Selection {
    const clone = new Selection({
      cross: this.#cross,
      empty: this.#empty,
      union: this.#union,
      single: this.#single,
    });
    clone.#clauses = this.#resolve(this.#clauses, sourceMarker(source), false);
    clone.#active = sourceMarker(source);
    return clone;
  }

  /**
   * Remove the given clauses, or all when none are given, invoking
   * `reset` on their sources when defined; relays downstream.
   *
   * @example
   * selection.reset(); // clear everything
   */
  reset(clauses?: readonly SelectionClause[]): this {
    const removed = clauses ?? this.#clauses;
    const dropped = new Set(removed);
    for (const clause of dropped) resetSource(clause.source);
    this.#clauses = this.#clauses.filter((clause) => !dropped.has(clause));
    for (const downstream of this.#relay) downstream.reset([...dropped]);
    this.#notify();
    return this;
  }

  /**
   * The clause value a source published, `undefined` if it published none.
   *
   * @example
   * selection.valueFor(regionFilter); // "West" | undefined
   */
  valueFor(source: ClauseSource): unknown {
    return this.#clauses.find((clause) => clause.source === source)?.value;
  }

  /**
   * Whether a clause must not filter a client: only under cross-filtering,
   * and only when the clause names that client as a skip target.
   *
   * @example
   * selection.skip(client, clause); // true for the publishing client
   */
  skip(
    client: QueryClient | null | undefined,
    clause: SelectionClause | undefined,
  ): boolean {
    if (client == null) return false;
    return Boolean(this.#cross && clause?.clients?.has(client));
  }

  /**
   * The predicate filtering a client's data: clauses minus the ones that
   * skip it, composed under the strategy. `undefined` = no filtering; a
   * skipped active clause also yields `undefined` (the client is excluded
   * from its own selection entirely).
   *
   * @example
   * client.query(selection.predicate(client));
   */
  predicate(client?: QueryClient | null): FilterPredicate | undefined {
    if (this.#empty && this.#clauses.length === 0) {
      return { sql: "false", params: [] };
    }
    if (this.skip(client, this.#active)) return undefined;
    const predicates = this.#clauses
      .filter((clause) => !this.skip(client, clause))
      .map((clause) => clause.predicate)
      .filter((predicate): predicate is FilterPredicate => predicate !== null);
    return this.#union ? composeOr(predicates) : composeAnd(predicates);
  }

  /**
   * Observe updates and resets; pairs with React's `useSyncExternalStore`.
   *
   * @example
   * const unsubscribe = selection.subscribe(() => requery(client));
   */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Replace-by-source: drop the source's clause, keep others unless `single`, push non-null predicates. */
  #resolve(
    clauseList: readonly SelectionClause[],
    clause: SelectionClause,
    reset: boolean,
  ): SelectionClause[] {
    const filtered = clauseList.filter(
      (existing) => clause.source !== existing.source,
    );
    if (this.#single && reset)
      filtered.forEach((existing) => resetSource(existing.source));
    const clauses = this.#single ? [] : filtered;
    if (clause.predicate) clauses.push(clause);
    return clauses;
  }

  #notify() {
    for (const listener of this.#listeners) listener();
  }
}
