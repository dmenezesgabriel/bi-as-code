import { describe, expect, it, vi } from "vitest";
import { clauseNone, clausePoint } from "./clause";
import { Selection } from "./selection";
import type { QueryClient } from "./types";

/** Stand-in clause sources — identity, not shape, is what resolution keys on. */
const sourceA = {};
const sourceB = {};

const client: QueryClient = {
  query: () => undefined,
  queryPending: () => {},
  queryResult: () => {},
  queryError: () => {},
};

describe("Selection", () => {
  it("stores an updated clause and tracks it as active", () => {
    const selection = new Selection();
    const clause = clausePoint("column", 5, { source: sourceA });

    selection.update(clause);

    expect(selection.clauses[0]).toBe(clause);
    expect(selection.active).toBe(clause);
    expect(selection.clauses).toHaveLength(1);
  });

  it("reset removes every clause", () => {
    const selection = new Selection();
    selection.update(clausePoint("column", 5, { source: sourceA }));

    selection.reset();

    expect(selection.clauses).toEqual([]);
  });

  it("clears a source's clause when a null-predicate clause arrives", () => {
    const selection = new Selection();
    selection.update(clausePoint("column", 5, { source: sourceA }));
    expect(selection.clauses).toHaveLength(1);

    const clause = clauseNone(sourceA);
    selection.update(clause);

    expect(selection.active).toBe(clause);
    expect(selection.clauses).toHaveLength(0);
  });

  it("replaces a clause from the same source", () => {
    const selection = new Selection();

    selection.update(clausePoint("region", "West", { source: sourceA }));
    selection.update(clausePoint("region", "East", { source: sourceA }));

    expect(selection.clauses).toHaveLength(1);
    expect(selection.clauses[0]?.value).toBe("East");
    expect(selection.active?.value).toBe("East");
  });

  it("intersect accumulates one clause per source", () => {
    const selection = new Selection();

    selection.update(clausePoint("region", "West", { source: sourceA }));
    selection.update(clausePoint("channel", "online", { source: sourceB }));

    expect(selection.clauses).toHaveLength(2);
  });

  it("intersect composes clauses conjunctively", () => {
    const selection = new Selection();
    selection.update(clausePoint("region", "West", { source: sourceA }));
    selection.update(clausePoint("amount", 10, { source: sourceB }));

    expect(selection.predicate()).toEqual({
      sql: "(region = ?) AND (amount = ?)",
      params: ["West", 10],
    });
  });

  it("union composes clauses disjunctively", () => {
    const selection = Selection.union();
    selection.update(clausePoint("region", "West", { source: sourceA }));
    selection.update(clausePoint("region", "East", { source: sourceB }));

    expect(selection.predicate()).toEqual({
      sql: "(region = ?) OR (region = ?)",
      params: ["West", "East"],
    });
  });

  it("single keeps only the most recent clause", () => {
    const selection = Selection.single();

    selection.update(clausePoint("region", "West", { source: sourceA }));
    selection.update(clausePoint("region", "East", { source: sourceB }));

    expect(selection.clauses).toHaveLength(1);
    expect(selection.active?.source).toBe(sourceB);
  });

  it("single resets the sources it drops", () => {
    const dropped = { reset: vi.fn() };
    const selection = Selection.single();

    selection.update(clausePoint("region", "West", { source: dropped }));
    selection.update(clausePoint("region", "East", { source: sourceB }));

    expect(dropped.reset).toHaveBeenCalledOnce();
  });

  it("yields no predicate with no clauses by default", () => {
    const selection = new Selection();

    expect(selection.predicate()).toBeUndefined();
    expect(selection.active).toBeUndefined();
  });

  it("empty: true yields the false literal with no clauses", () => {
    const selection = Selection.intersect({ empty: true });

    expect(selection.predicate()).toEqual({ sql: "false", params: [] });

    selection.update(clausePoint("region", "West", { source: sourceA }));
    expect(selection.predicate()).toEqual({
      sql: "region = ?",
      params: ["West"],
    });
  });

  it("cross-filtering skips a clause's registered clients", () => {
    const selection = Selection.crossfilter();
    const clause = clausePoint("region", "West", {
      source: sourceA,
      clients: new Set([client]),
    });
    selection.update(clause);

    expect(selection.skip(client, clause)).toBe(true);
    expect(selection.skip(undefined, clause)).toBe(false);
    expect(selection.predicate(client)).toBeUndefined();
    expect(selection.predicate({ ...client })).toEqual({
      sql: "region = ?",
      params: ["West"],
    });
  });

  it("skips nothing without the cross flag", () => {
    const selection = new Selection();
    const clause = clausePoint("region", "West", {
      source: sourceA,
      clients: new Set([client]),
    });
    selection.update(clause);

    expect(selection.skip(client, clause)).toBe(false);
    expect(selection.predicate(client)).toEqual({
      sql: "region = ?",
      params: ["West"],
    });
  });

  it("drops skipped clauses but keeps the rest per client", () => {
    const selection = Selection.crossfilter();
    selection.update(
      clausePoint("region", "West", {
        source: sourceA,
        clients: new Set([client]),
      }),
    );
    selection.update(clausePoint("amount", 10, { source: sourceB }));

    expect(selection.predicate(client)).toEqual({
      sql: "amount = ?",
      params: [10],
    });
    expect(selection.predicate({ ...client })).toEqual({
      sql: "(region = ?) AND (amount = ?)",
      params: ["West", 10],
    });
  });

  it("valueFor reads the clause value of a source", () => {
    const selection = new Selection();
    selection.update(clausePoint("region", "West", { source: sourceA }));

    expect(selection.valueFor(sourceA)).toBe("West");
    expect(selection.valueFor(sourceB)).toBeUndefined();
  });

  it("remove returns a clone without the source's clauses, original untouched", () => {
    const selection = new Selection();
    const clauseA = clausePoint("a", 1, { source: sourceA });
    const clauseB = clausePoint("b", 2, { source: sourceB });
    selection.update(clauseA);
    selection.update(clauseB);

    const removed = selection.remove(sourceA);

    expect(removed.clauses).toEqual([clauseB]);
    expect(removed.active?.source).toBe(sourceA);
    expect(selection.clauses).toEqual([clauseA, clauseB]);
  });
});

describe("Selection include relay", () => {
  it("relays upstream updates into the downstream selection", () => {
    const selectionA = new Selection();
    const selectionB = new Selection();
    const upstream = Selection.crossfilter({
      include: [selectionA, selectionB],
    });

    const clauseA = clausePoint("a", 1, { source: sourceA });
    const clauseB = clausePoint("b", 2, { source: sourceB });
    selectionA.update(clauseA);
    selectionB.update(clauseB);

    expect(upstream.clauses).toHaveLength(2);
    expect(upstream.clauses).toContain(clauseA);
    expect(upstream.clauses).toContain(clauseB);
  });

  it("relays reset downstream", () => {
    const selectionA = new Selection();
    const selectionB = new Selection();
    const upstream = Selection.crossfilter({
      include: [selectionA, selectionB],
    });

    selectionA.update(clausePoint("a", 1, { source: sourceA }));
    selectionB.update(clausePoint("b", 2, { source: sourceB }));

    selectionB.reset();
    expect(upstream.clauses).toHaveLength(1);

    selectionA.reset();
    expect(upstream.clauses).toHaveLength(0);
  });

  it("can specify a clause to reset", () => {
    const selectionA = new Selection();
    const selectionB = new Selection();
    const upstream = Selection.crossfilter({
      include: [selectionA, selectionB],
    });

    const clauseA = clausePoint("a", 1, { source: sourceA });
    const clauseB = clausePoint("b", 2, { source: sourceB });
    selectionA.update(clauseA);
    selectionB.update(clauseB);

    upstream.reset([clauseB]);

    expect(upstream.clauses).toHaveLength(1);
    expect(upstream.clauses).toContain(clauseA);
  });
});

describe("Selection subscribe", () => {
  it("notifies on update and reset until unsubscribed", () => {
    const selection = new Selection();
    const listener = vi.fn();
    const unsubscribe = selection.subscribe(listener);

    selection.update(clausePoint("region", "West", { source: sourceA }));
    expect(listener).toHaveBeenCalledOnce();

    selection.reset();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    selection.update(clausePoint("region", "East", { source: sourceB }));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

/** A listener whose every call stays pending until the test releases it. */
class HeldListener {
  readonly seen: unknown[] = [];
  readonly #release: Array<() => void> = [];

  constructor(readonly selection: Selection) {}

  readonly listener = (): Promise<void> => {
    this.seen.push(this.selection.active?.value);
    return new Promise((resolve) => this.#release.push(resolve));
  };

  /** Release the oldest pending call, then let the next delivery run. */
  async release(): Promise<void> {
    this.#release.shift()?.();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

describe("Selection dispatch while a listener is pending", () => {
  it("resolves predicates against the delivered clause, not the queued one", () => {
    const selection = new Selection();
    selection.subscribe(new HeldListener(selection).listener);
    selection.update(clausePoint("region", "West", { source: sourceA }));

    selection.update(clausePoint("region", "East", { source: sourceA }));

    expect(selection.active?.value).toBe("West");
    expect(selection.predicate()?.params).toEqual(["West"]);
  });

  it("delivers only the latest queued update without cross", async () => {
    const selection = new Selection();
    const held = new HeldListener(selection);
    selection.subscribe(held.listener);
    selection.update(clausePoint("region", "West", { source: sourceA }));

    selection.update(clausePoint("channel", "Web", { source: sourceB }));
    selection.update(clausePoint("region", "East", { source: sourceA }));
    await held.release();

    expect(held.seen).toEqual(["West", "East"]);
    expect(selection.clauses.map((clause) => clause.value)).toEqual([
      "Web",
      "East",
    ]);
  });

  it("under cross collapses one source's queued updates and keeps another's", async () => {
    const selection = Selection.crossfilter();
    const held = new HeldListener(selection);
    selection.subscribe(held.listener);
    selection.update(clausePoint("region", "West", { source: sourceA }));

    selection.update(clausePoint("region", "East", { source: sourceA }));
    selection.update(clausePoint("channel", "Web", { source: sourceB }));
    selection.update(clausePoint("region", "North", { source: sourceA }));
    await held.release();
    await held.release();

    expect(held.seen).toEqual(["West", "Web", "North"]);
  });

  it("queues a reset behind the pending delivery", async () => {
    const selection = new Selection();
    const held = new HeldListener(selection);
    selection.subscribe(held.listener);
    selection.update(clausePoint("region", "West", { source: sourceA }));

    selection.reset();
    expect(selection.clauses).toHaveLength(1);
    await held.release();

    expect(selection.clauses).toEqual([]);
    expect(held.seen).toHaveLength(2);
  });
});
