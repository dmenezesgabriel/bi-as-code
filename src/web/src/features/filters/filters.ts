import { Coordinator } from "../crossfilter/coordinator";
import type { Selection } from "../crossfilter/selection";
import { Filter, type FilterOptions } from "./filter";
import type { FilterUrlPort } from "./filter-url-port";
import { decodeSearchParam } from "./search-param-value";

/**
 * A page's named filters — the port of evidence's `Filters.svelte.ts` —
 * and the page's cross-filter `Coordinator`: each `Filter` owns the
 * `Selection` it publishes into, and `coordinator` brokers every
 * `filters=[...]` consumer's re-query. Page-scoped: each page mounts its
 * own collection, seeded from the URL.
 */
export class Filters {
  readonly #filters = new Map<string, Filter>();
  readonly #port: FilterUrlPort;
  readonly #coordinator: Coordinator;
  readonly #listeners = new Set<() => void>();

  constructor(port: FilterUrlPort, coordinator = new Coordinator()) {
    this.#port = port;
    this.#coordinator = coordinator;
  }

  /** The page's cross-filter coordinator — clients connect through it. */
  get coordinator(): Coordinator {
    return this.#coordinator;
  }

  /**
   * Create the filter, or configure the existing one — "ensure exists",
   * never "reset to this value" (evidence's collision rule), so a value
   * restored from the URL survives a second consumer's `ensure`. Provided
   * `opts` still apply to the existing filter, so an input mounting after
   * a consumer's bare `ensure` lands its codec and predicate column
   * without waiting for remount order.
   *
   * @example
   * filters.ensure("region").value; // "West" when the URL has ?region=West
   */
  ensure<Value>(id: string, opts?: FilterOptions<Value>): Filter<Value> {
    const existing = this.#filters.get(id);
    if (existing) {
      const filter = existing as Filter<Value>;
      filter.configure(opts);
      return filter;
    }
    const filter = new Filter<Value>(
      id,
      { ...opts, column: opts?.column ?? id },
      this.#port,
    );
    this.#filters.set(id, filter);
    filter.subscribe(() => this.#notify());
    return filter;
  }

  /**
   * Every filter's held value as `{{params.*}}` binds it — the value
   * decoded from its URL-param form, so a value the URL does not hold
   * (an `initialValue`, a `setDefault` seed) binds exactly as it would
   * once written there. A cleared filter binds nothing. Evidence's inline
   * SQL reads each input's `.value` the same way.
   *
   * @example
   * filters.ensure("span", { initialValue: "last 7 days" });
   * filters.heldParams(); // → { span: "last 7 days" }
   */
  heldParams(): Readonly<Record<string, unknown>> {
    const params: Record<string, unknown> = {};
    for (const [id, filter] of this.#filters) {
      const serialized = filter.serializedValue;
      if (serialized) params[id] = decodeSearchParam(serialized);
    }
    return params;
  }

  /** Fires on any filter's value change, filters created later included. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * The selection filter `id` publishes into — ensure-creates like
   * `ensure`, so a `filters=[...]` consumer always resolves the canonical
   * selection even when no input has mounted for the id yet.
   */
  selection(id: string): Selection {
    return this.ensure(id).selection;
  }

  get(id: string): Filter | undefined {
    return this.#filters.get(id);
  }

  has(id: string): boolean {
    return this.#filters.has(id);
  }

  /** Clears the value first — deleting the URL param — then drops the filter. */
  remove(id: string) {
    const filter = this.#filters.get(id);
    if (filter) filter.value = undefined;
    this.#filters.delete(id);
  }

  #notify() {
    for (const listener of this.#listeners) listener();
  }
}
