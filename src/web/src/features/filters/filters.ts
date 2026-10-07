import { Filter, type FilterOptions } from "./filter";
import type { FilterUrlPort } from "./filter-url-port";

/**
 * A page's named filters — the port of evidence's `Filters.svelte.ts`.
 * Page-scoped: each page mounts its own collection, seeded from the URL.
 */
export class Filters {
  readonly #filters = new Map<string, Filter>();
  readonly #port: FilterUrlPort;

  constructor(port: FilterUrlPort) {
    this.#port = port;
  }

  /**
   * Create the filter, or return the existing one unchanged — "ensure
   * exists", never "reset to this value" (evidence's collision rule), so a
   * value restored from the URL survives a second consumer's `ensure`.
   *
   * @example
   * filters.ensure("region").value; // "West" when the URL has ?region=West
   */
  ensure<Value>(id: string, opts?: FilterOptions<Value>): Filter<Value> {
    const existing = this.#filters.get(id);
    if (existing) return existing as Filter<Value>;
    const filter = new Filter<Value>(
      id,
      { ...opts, column: opts?.column ?? id },
      this.#port,
    );
    this.#filters.set(id, filter);
    return filter;
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
}
