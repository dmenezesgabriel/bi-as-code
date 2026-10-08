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
 */
import type { FilterPredicate } from "../crossfilter/types";
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
   * Builds the WHERE fragment for the held value; the default emits
   * `column = ?` or `column IN (...)`. Returning `undefined` contributes no
   * predicate for that value (a range input half-set stays silent —
   * evidence's `predicateSql` no-op branches).
   */
  predicate?(
    column: string,
    value: Value | undefined,
  ): FilterPredicate | undefined;
}

interface ResolvedOptions<Value> {
  column?: string | false;
  initialValue?: Value;
  serialize(value: Value | undefined): string | undefined;
  deserialize(raw: string): Value;
  predicate?(
    column: string,
    value: Value | undefined,
  ): FilterPredicate | undefined;
}

const defaultSerialize = (value: unknown): string | undefined =>
  value === undefined ? undefined : String(value);

export class Filter<Value = unknown> {
  readonly id: string;
  readonly #opts: ResolvedOptions<Value>;
  readonly #port: FilterUrlPort;
  readonly #listeners = new Set<() => void>();
  #value: Value | undefined;
  #lastSerialized: string | undefined;
  #isInitializing = true;

  constructor(id: string, opts: FilterOptions<Value>, port: FilterUrlPort) {
    this.id = id;
    this.#opts = {
      column: opts.column,
      initialValue: opts.initialValue,
      serialize: opts.serialize ?? defaultSerialize,
      deserialize: opts.deserialize ?? ((raw) => raw as Value),
      predicate: opts.predicate,
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
    if (!Object.is(previous, newValue)) this.#notify();
    if (this.#isInitializing || !changed) return;
    this.#writeUrl(serialized);
  }

  /** Programmatic default: updates state, never the URL. A later echo of the same value writes nothing. */
  setDefault(newValue: Value | undefined) {
    const previous = this.#value;
    this.#value = newValue;
    this.#lastSerialized = this.#opts.serialize(newValue);
    if (!Object.is(previous, newValue)) this.#notify();
  }

  /**
   * Apply late-arriving options to an existing filter — provided fields
   * replace their counterpart, absent ones are kept, and a held value is
   * never reset. A fresh `deserialize` re-reads the live URL param through
   * `setDefault`, repairing a value decoded under the default codec (a
   * consumer's bare `ensure` beat the input's) without writing the URL —
   * evidence's `addOrUpdateFilters` reaches the same end state by recreating
   * the filter. `initialValue` seeds via `setDefault` only when nothing is
   * held, so a cleared `""`/`[]` never snaps back.
   */
  configure(opts?: FilterOptions<Value>) {
    if (!opts) return;
    if (opts.column !== undefined) this.#opts.column = opts.column;
    if (opts.serialize) this.#opts.serialize = opts.serialize;
    if (opts.predicate) this.#opts.predicate = opts.predicate;
    if (opts.deserialize) {
      this.#opts.deserialize = opts.deserialize;
      const raw = this.#port.read()?.searchParams.get(this.id);
      if (raw) this.setDefault(opts.deserialize(raw));
    }
    if (opts.initialValue !== undefined && this.#value === undefined) {
      this.setDefault(opts.initialValue);
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
   * The WHERE fragment this filter contributes, values bound as `?` args —
   * never text-interpolated (ADR-0005). `undefined` = contributes none.
   * An input-supplied `predicate` builder owns the shape; the default is
   * `=`/`IN`.
   */
  predicate(): FilterPredicate | undefined {
    const column = this.#opts.column;
    if (!column) return undefined;
    const value = this.#value;
    if (this.#opts.predicate) return this.#opts.predicate(column, value);
    if (Array.isArray(value)) {
      if (value.length === 0) return undefined;
      return {
        sql: `${column} IN (${value.map(() => "?").join(", ")})`,
        params: [...value],
      };
    }
    if (value === undefined || value === null || value === "") return undefined;
    return { sql: `${column} = ?`, params: [value] };
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
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
