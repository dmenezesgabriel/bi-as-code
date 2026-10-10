import type { InterpolatedQuery } from "../pages/interpolate";
import type { QueryResult } from "../pages/types";
import { composeAnd } from "./clause";
import { Selection } from "./selection";
import type { FilterPredicate, QueryClient, QueryRunner } from "./types";

/** A filter group: one selection and every client consuming it. */
interface FilterGroup {
  readonly clients: Set<QueryClient>;
  readonly unsubscribe: () => void;
}

/** A connected client's declared selections, runner and in-flight query. */
interface ClientEntry {
  readonly selections: readonly Selection[];
  readonly run: QueryRunner;
  controller: AbortController | null;
}

/**
 * The cross-filter broker, the port of mosaic's `Coordinator` stripped to
 * what a page needs: it owns no connector — clients carry their own runner
 * (runtime + registered block) at connect — and no result cache, query
 * consolidation or preaggregation (ADR-0004). A publish re-queries each
 * client in the published selection's group under its composed predicate,
 * and the selection holds its next publish until every one of those
 * queries settles — latest-wins, so a drag that publishes faster than the
 * group can query still paints each completed result; a clause
 * that names a client skips it (no query), and a client whose selections
 * compose no predicate gets none either — the bridge serves the unfiltered
 * registry result in that case.
 *
 * @example
 * const coordinator = new Coordinator();
 * coordinator.connect(client, [selection], run);
 */
export class Coordinator {
  readonly #clients = new Map<QueryClient, ClientEntry>();
  readonly #groups = new Map<Selection, FilterGroup>();

  /**
   * Connect a client against the selections it consumes, issuing its first
   * query when those compose a predicate. Throws when the client is
   * already connected.
   *
   * @example
   * coordinator.connect(client, [regionSelection], run);
   */
  connect(
    client: QueryClient,
    selections: readonly Selection[],
    run: QueryRunner,
  ): void {
    if (this.#clients.has(client)) throw new Error("Client already connected.");
    this.#clients.set(client, { selections, run, controller: null });
    for (const selection of selections)
      this.#groupFor(selection).clients.add(client);
    void this.#updateClient(client);
  }

  /**
   * Remove a client: its in-flight query is abandoned and it stops
   * re-querying. No effect for a client that is not connected.
   *
   * @example
   * coordinator.disconnect(client); // in a React effect cleanup
   */
  disconnect(client: QueryClient): void {
    const entry = this.#clients.get(client);
    if (!entry) return;
    this.#clients.delete(client);
    entry.controller?.abort();
    for (const selection of entry.selections) {
      const group = this.#groups.get(selection);
      if (!group) continue;
      group.clients.delete(client);
      if (group.clients.size === 0) {
        // Unlike mosaic, which tears groups down only in clear(): clients
        // mount and unmount with React, so an emptied group must not keep
        // its selection subscription alive.
        group.unsubscribe();
        this.#groups.delete(selection);
      }
    }
  }

  /**
   * Re-query a connected client now, under its current composed predicate —
   * for data changes outside any publish (a re-interpolated block).
   *
   * @example
   * coordinator.requestQuery(client); // the block changed under the client
   */
  requestQuery(client: QueryClient): Promise<void> {
    return this.#updateClient(client);
  }

  #groupFor(selection: Selection): FilterGroup {
    const existing = this.#groups.get(selection);
    if (existing) return existing;
    const clients = new Set<QueryClient>();
    // Returning the group's settle promise is what serializes the
    // selection's deliveries (see `Selection`).
    const unsubscribe = selection.subscribe(() =>
      this.#updateSelection(selection),
    );
    const group = { clients, unsubscribe };
    this.#groups.set(selection, group);
    return group;
  }

  #updateSelection(selection: Selection): Promise<unknown> | undefined {
    const group = this.#groups.get(selection);
    if (!group) return undefined;
    return Promise.allSettled(
      [...group.clients].map((client) => this.#updateClient(client, selection)),
    );
  }

  async #updateClient(
    client: QueryClient,
    published?: Selection,
  ): Promise<void> {
    const entry = this.#clients.get(client);
    if (!entry) return;
    if (published && published.skip(client, published.active)) return;
    const predicate = this.#predicateFor(entry, client);
    if (!predicate) return;
    const query = client.query(predicate);
    if (!query) return;
    // A selection never overlaps its own re-queries, so this abort only
    // fires across paths: connect or `requestQuery` racing a publish, or a
    // second selection of the same client — the newer query composes every
    // selection's current clauses, so the older result is already stale.
    entry.controller?.abort();
    const controller = new AbortController();
    entry.controller = controller;
    client.queryPending();
    const result = await this.#run(entry, query, controller);
    if (controller.signal.aborted) return;
    if (result.status === "success") client.queryResult(result.rows);
    else if (result.status === "error") client.queryError(result.message);
  }

  #predicateFor(
    entry: ClientEntry,
    client: QueryClient,
  ): FilterPredicate | undefined {
    return composeAnd(
      entry.selections
        .map((selection) => selection.predicate(client))
        .filter((p): p is FilterPredicate => p !== undefined),
    );
  }

  async #run(
    entry: ClientEntry,
    query: InterpolatedQuery,
    controller: AbortController,
  ): Promise<QueryResult> {
    try {
      return await entry.run(query, controller.signal);
    } catch (cause) {
      return {
        status: "error",
        message: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }
}
