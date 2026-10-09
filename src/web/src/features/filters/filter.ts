/**
 * The named-filter model, a semantic port of evidence's `Filter.svelte.ts`:
 * the URL is the persistence layer through an injected `FilterUrlPort`, and
 * the port is the only browser boundary, so tests drive the model with an
 * in-memory fake.
 *
 * Value priority: URL param > `initialValue` > `setDefault` > undefined.
 * `value` is the user-interaction setter (writes the URL);
 * `setDefault` is programmatic (never writes); `normalize` corrects a
 * constrained value and writes only when the param is already there.
 *
 * Every value change also publishes a `SelectionClause` into the filter's
 * own `Selection` (ADR-0004) — the coordinator's clients re-query under the
 * clauses that survive skip resolution.
 */
import { clauseList, clauseNone, clausePoint } from "../crossfilter/clause";
import { Selection } from "../crossfilter/selection";
import type {
  ClauseOptions,
  QueryClient,
  SelectionClause,
} from "../crossfilter/types";
import type { FilterUrlPort } from "./filter-url-port";

export interface FilterOptions<Value = unknown> {
  /**
   * Predicate column; `Filters.ensure` defaults it to the filter id.
   * `false` opts the filter out of `filters=[...]` predication entirely —
   * inputs whose value is consumed through `{{params.id}}` instead
   * (evidence's filters whose `sql` getter is undefined).
   */
  column?: string | false;
  /** Programmatic fallback when neither URL nor author supplies a value. */
  initialValue?: Value;
  /** Value → URL-param string; `undefined` or `""` = no param (cleared). */
  serialize?(value: Value | undefined): string | undefined;
  /** URL-param string → value. */
  deserialize?(raw: string): Value;
  /**
   * Builds the clause published on each value change; the default emits a
   * point clause (`column = ?`) or a list clause (`column IN (…)`) for the
   * held value. A range input's half-set state stays silent through a
   * predicate-less clause (evidence's `predicateSql` no-op branches).
   */
  clause?(
    column: string,
    value: Value | undefined,
    context: ClauseOptions,
  ): SelectionClause;
}

interface ResolvedOptions<Value> {
  column?: string | false;
  initialValue?: Value;
  serialize(value: Value | undefined): string | undefined;
  deserialize(raw: string): Value;
  clause?(
    column: string,
    value: Value | undefined,
    context: ClauseOptions,
  ): SelectionClause;
}

const defaultSerialize = (value: unknown): string | undefined =>
  value === undefined ? undefined : String(value);

/**
 * The `=`/`IN` clause a filter publishes absent an input-supplied factory —
 * `""`, `null` and `undefined` all carry no predicate, so they clear.
 */
function defaultClause<Value>(
  column: string,
  value: Value | undefined,
  context: ClauseOptions,
): SelectionClause {
  if (Array.isArray(value)) return clauseList(column, value, context);
  return clausePoint(column, value === "" ? null : value, context);
}

export class Filter<Value = unknown> {
  readonly id: string;
  /**
   * The selection this filter publishes its clauses into — `cross`, so a
   * client the clause names (the input's own data query, registered through
   * `registerClient`) is never narrowed by it.
   */
  readonly selection = Selection.crossfilter();
  readonly #opts: ResolvedOptions<Value>;
  readonly #port: FilterUrlPort;
  readonly #listeners = new Set<() => void>();
  /**
   * Clients this filter's clauses skip — handed to each clause as the live
   * set, so a client registering after a clause was published (a URL-seeded
   * value precedes any mount effect) is still excluded by it.
   */
  readonly #clients = new Set<QueryClient>();
  #value: Value | undefined;
  #lastSerialized: string | undefined;
  #lastClauseKey = "";
  #isInitializing = true;

  constructor(id: string, opts: FilterOptions<Value>, port: FilterUrlPort) {
    this.id = id;
    this.#opts = {
      column: opts.column,
      initialValue: opts.initialValue,
      serialize: opts.serialize ?? defaultSerialize,
      deserialize: opts.deserialize ?? ((raw) => raw as Value),
      clause: opts.clause,
    };
    this.#port = port;
    const raw = port.read()?.searchParams.get(id);
    if (raw) {
      this.value = this.#opts.deserialize(raw);
    } else if (this.#opts.initialValue !== undefined) {
      this.value = this.#opts.initialValue;
    }
    this.#isInitializing = false;
  }

  /** Current value; pairs with `subscribe` for `useSyncExternalStore`. */
  getSnapshot(): Value | undefined {
    return this.#value;
  }

  get value(): Value | undefined {
    return this.#value;
  }

  set value(newValue: Value | undefined) {
    const previous = this.#value;
    this.#value = newValue;
    const serialized = this.#opts.serialize(newValue);
    const changed = serialized !== this.#lastSerialized;
    this.#lastSerialized = serialized;
    if (!Object.is(previous, newValue)) {
      this.#notify();
      this.#publish();
    }
    if (this.#isInitializing || !changed) return;
    this.#writeUrl(serialized);
  }

  /** Programmatic default: updates state, never the URL. A later echo of the same value writes nothing. */
  setDefault(newValue: Value | undefined) {
    const previous = this.#value;
    this.#value = newValue;
    this.#lastSerialized = this.#opts.serialize(newValue);
    if (!Object.is(previous, newValue)) {
      this.#notify();
      this.#publish();
    }
  }

  /**
   * Apply late-arriving options to an existing filter — provided fields
   * replace their counterpart, absent ones are kept, and a held value is
   * never reset. A fresh `deserialize` re-reads the live URL param through
   * `setDefault`, repairing a value decoded under the default codec (a
   * consumer's bare `ensure` beat the input's) without writing the URL —
   * evidence's `addOrUpdateFilters` reaches the same end state by recreating
   * the filter. `initialValue` seeds via `setDefault` only when nothing is
   * held, so a cleared `""`/`[]` never snaps back. A `column`/`clause` swap
   * on an unchanged value republishes the held clause under the new shape.
   */
  configure(opts?: FilterOptions<Value>) {
    if (!opts) return;
    const valueBefore = this.#value;
    if (opts.column !== undefined) this.#opts.column = opts.column;
    if (opts.serialize) this.#opts.serialize = opts.serialize;
    if (opts.clause) this.#opts.clause = opts.clause;
    if (opts.deserialize) {
      this.#opts.deserialize = opts.deserialize;
      const raw = this.#port.read()?.searchParams.get(this.id);
      if (raw) this.setDefault(opts.deserialize(raw));
    }
    if (opts.initialValue !== undefined && this.#value === undefined) {
      this.setDefault(opts.initialValue);
    }
    if (
      (opts.column !== undefined || opts.clause !== undefined) &&
      Object.is(valueBefore, this.#value)
    ) {
      this.#publish();
    }
  }

  /** Corrected value: keeps the URL in sync when the param is present, else behaves as a default. */
  normalize(newValue: Value | undefined) {
    if (this.#port.read()?.searchParams.has(this.id)) {
      this.value = newValue;
    } else {
      this.setDefault(newValue);
    }
  }

  /** Apply a value in its URL-param form, as a user interaction. Empty/undefined clears. */
  applySerialized(raw: string | undefined) {
    this.value = raw ? this.#opts.deserialize(raw) : undefined;
  }

  /** Current value in its serialized (URL-param) string form. */
  get serializedValue(): string | undefined {
    return this.#opts.serialize(this.#value);
  }

  /**
   * Register a client this filter's clauses must skip under `cross` — the
   * input's own data query (an options or bounds source) so it is never
   * narrowed by its own pick. Returns the unregister cleanup.
   *
   * @example
   * useEffect(() => filter.registerClient(client), [filter, client]);
   */
  registerClient(client: QueryClient): () => void {
    this.#clients.add(client);
    return () => {
      this.#clients.delete(client);
    };
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Publish the held value's clause into the page selection — `column:
   * false` emits `clauseNone`, which only clears. An identical predicate
   * skips the update entirely: the serialized key stands in for mosaic's
   * `Param.distinct()`, so a `column: false` keystroke or a same-content
   * array write never re-queries the selection's clients.
   */
  #publish() {
    const column = this.#opts.column;
    const clause = column
      ? (this.#opts.clause ?? defaultClause)(column, this.#value, {
          source: this,
          clients: this.#clients,
        })
      : clauseNone(this);
    const key = clause.predicate
      ? `${clause.predicate.sql}|${JSON.stringify(clause.predicate.params)}`
      : "";
    if (key === this.#lastClauseKey) return;
    this.#lastClauseKey = key;
    this.selection.update(clause);
  }

  #writeUrl(serialized: string | undefined) {
    const current = this.#port.read();
    if (!current) return;
    if (serialized) {
      current.searchParams.set(this.id, serialized);
    } else {
      current.searchParams.delete(this.id);
    }
    this.#port.write(current);
  }

  #notify() {
    for (const listener of this.#listeners) listener();
  }
}
