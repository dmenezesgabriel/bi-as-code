import { AsyncDispatch, type QueueKeep } from "./async-dispatch";
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

/** A selection listener; a returned promise holds later deliveries until it settles. */
type SelectionListener = () => void | Promise<unknown>;

/** Resolved clauses plus the clause that produced them — one delivery's state. */
interface ClauseSnapshot {
  readonly clauses: readonly SelectionClause[];
  readonly active: SelectionClause | undefined;
}

/**
 * A dynamic set of selection clauses resolved into one query predicate —
 * the port of mosaic's `Selection`/`SelectionResolver` over bound
 * fragments (ADR-0004): clauses replace by source identity, a null
 * predicate clears its source, and `cross` skips a clause on the clients
 * that published it. Listeners returning a promise serialize delivery
 * (mosaic's `AsyncDispatch`): updates arriving while one is pending queue,
 * the readers (`clauses`, `active`, `predicate`) keep the delivered state,
 * and only the latest queued update delivers — under `cross`, the latest
 * per source, so another widget's clause queued behind a drag survives.
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
  /** The resolved state every update builds on, delivered or not. */
  #latest: ClauseSnapshot = { clauses: [], active: undefined };
  /** The state the last delivery published — what readers resolve against. */
  #delivered: ClauseSnapshot = this.#latest;
  readonly #relay = new Set<Selection>();
  readonly #listeners = new Set<SelectionListener>();
  readonly #dispatch = new AsyncDispatch<ClauseSnapshot>((snapshot) =>
    this.#deliver(snapshot),
  );

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
    return this.#delivered.clauses;
  }

  /** The most recently updated clause, if any. */
  get active(): SelectionClause | undefined {
    return this.#delivered.active;
  }

  /**
   * Add or replace a clause; a null predicate clears its source's clause.
   * Relays to downstream selections that include this one.
   *
   * @example
   * selection.update(clausePoint("region", "West", { source: filter }));
   */
  update(clause: SelectionClause): this {
    const clauses = this.#resolve(this.#latest.clauses, clause, true);
    for (const downstream of this.#relay) downstream.update(clause);
    this.#emit({ clauses, active: clause });
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
    clone.#latest = {
      clauses: this.#resolve(this.#latest.clauses, sourceMarker(source), false),
      active: sourceMarker(source),
    };
    clone.#delivered = clone.#latest;
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
    const dropped = new Set(clauses ?? this.#latest.clauses);
    for (const clause of dropped) resetSource(clause.source);
    for (const downstream of this.#relay) downstream.reset([...dropped]);
    this.#emit({
      clauses: this.#latest.clauses.filter((clause) => !dropped.has(clause)),
      active: this.#latest.active,
    });
    return this;
  }

  /**
   * The clause value a source published, `undefined` if it published none.
   *
   * @example
   * selection.valueFor(regionFilter); // "West" | undefined
   */
  valueFor(source: ClauseSource): unknown {
    return this.clauses.find((clause) => clause.source === source)?.value;
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
    const { clauses, active } = this.#delivered;
    if (this.#empty && clauses.length === 0) {
      return { sql: "false", params: [] };
    }
    if (this.skip(client, active)) return undefined;
    const predicates = clauses
      .filter((clause) => !this.skip(client, clause))
      .map((clause) => clause.predicate)
      .filter((predicate): predicate is FilterPredicate => predicate !== null);
    return this.#union ? composeOr(predicates) : composeAnd(predicates);
  }

  /**
   * Observe updates and resets; pairs with React's `useSyncExternalStore`.
   * A listener's returned promise holds the next delivery until it settles.
   *
   * @example
   * const unsubscribe = selection.subscribe(() => requery(client));
   */
  subscribe(listener: SelectionListener): () => void {
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

  /** Record the latest state and dispatch it; `cross` keeps other sources' queued updates. */
  #emit(snapshot: ClauseSnapshot): void {
    this.#latest = snapshot;
    const source = snapshot.active?.source;
    const keep: QueueKeep<ClauseSnapshot> | undefined = this.#cross
      ? (queued) => queued.active?.source !== source
      : undefined;
    this.#dispatch.emit(snapshot, keep);
  }

  /** Publish the snapshot; the delivery is pending only while some listener's promise is. */
  #deliver(snapshot: ClauseSnapshot): Promise<unknown> | undefined {
    this.#delivered = snapshot;
    const settling = [...this.#listeners]
      .map((listener) => listener())
      .filter((returned) => returned instanceof Promise);
    return settling.length > 0 ? Promise.allSettled(settling) : undefined;
  }
}
