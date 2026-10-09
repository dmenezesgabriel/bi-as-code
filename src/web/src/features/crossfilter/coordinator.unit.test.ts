import { Exit, Layer, ManagedRuntime } from "effect";
import { describe, expect, it, vi } from "vitest";
import { DuckDb } from "../data/data-service";
import { FakeDuckDb } from "../data/fake-duckdb";
import type { DataRuntime } from "../data/runtime";
import type { Row } from "../data/types";
import type { InterpolatedQuery } from "../pages/interpolate";
import { runBlock } from "../pages/run-block";
import type { QueryResult } from "../pages/types";
import { clauseInterval, clauseList, clauseNone, clausePoint } from "./clause";
import { Coordinator } from "./coordinator";
import { Selection } from "./selection";
import type {
  FilterPredicate,
  QueryClient,
  QueryRunner,
  SelectionClause,
} from "./types";

/** A lazy ManagedRuntime over the fake, shaped as DataRuntime without React. */
function makeRuntime(db: FakeDuckDb): DataRuntime {
  let runtime: ManagedRuntime.ManagedRuntime<DuckDb, unknown> | null = null;
  const get = () =>
    (runtime ??= ManagedRuntime.make(Layer.succeed(DuckDb, db)));
  return {
    runPromise: (effect, options) => get().runPromise(effect, options),
    runPromiseExit: (effect, options) => get().runPromiseExit(effect, options),
    runFork: (effect, options) => get().runFork(effect, options),
  };
}

/** Hand-rolled QueryClient double: records every lifecycle callback. */
class FakeClient implements QueryClient {
  pendingCount = 0;
  readonly results: Row[][] = [];
  readonly errors: string[] = [];
  readonly asked: FilterPredicate[] = [];
  /** When set, `query` returns undefined — the client has nothing to run. */
  constructor(readonly omitQuery = false) {}

  query(predicate: FilterPredicate): InterpolatedQuery | undefined {
    this.asked.push(predicate);
    if (this.omitQuery) return undefined;
    return {
      sql: `select * from (base) where ${predicate.sql}`,
      params: [...predicate.params],
      errors: [],
    };
  }

  queryPending(): void {
    this.pendingCount += 1;
  }

  queryResult(rows: readonly Row[]): void {
    this.results.push([...rows]);
  }

  queryError(message: string): void {
    this.errors.push(message);
  }
}

/**
 * A fake whose every query is held until the test resolves it, keyed on the
 * first bound param — a wrapped query's sql is identical across filter
 * values, so params are the only distinguishing key.
 */
function holdingDb(): {
  db: FakeDuckDb;
  held: Map<string, (rows: Row[]) => void>;
} {
  const db = new FakeDuckDb();
  const held = new Map<string, (rows: Row[]) => void>();
  db.holdWhen = (_sql, params) =>
    new Promise<Row[]>((resolve) => held.set(String(params[0]), resolve));
  return { db, held };
}

function makeHarness(db: FakeDuckDb = new FakeDuckDb()) {
  const runtime = makeRuntime(db);
  const registered = Promise.resolve<Exit.Exit<void, unknown>>(
    Exit.succeed(undefined),
  );
  const run = (
    query: InterpolatedQuery,
    signal: AbortSignal,
  ): Promise<QueryResult> => runBlock(runtime, registered, query, signal);
  return { db, run, coordinator: new Coordinator() };
}

/** Connect a client — fresh unless given — against `selections`. */
function connectClient(
  coordinator: Coordinator,
  run: QueryRunner,
  selections: readonly Selection[],
  client: FakeClient = new FakeClient(),
): FakeClient {
  coordinator.connect(client, selections, run);
  return client;
}

/** Publish a clause, then wait for `settle` to hold — the publish→callback pairing. */
async function publish(
  selection: Selection,
  clause: SelectionClause,
  settle: () => unknown,
): Promise<void> {
  selection.update(clause);
  await vi.waitFor(settle);
}

/** One macrotask — lets issued queries reach the fake and aborted runs settle. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A connected client whose first query (`region = West`) is held in flight. */
async function heldClient() {
  const { db, held } = holdingDb();
  const { coordinator, run } = makeHarness(db);
  const selection = new Selection();
  const client = connectClient(coordinator, run, [selection]);
  await tick();
  const source = {};
  selection.update(clausePoint("region", "West", { source }));
  await tick();
  return { db, held, coordinator, selection, client, source };
}

describe("Coordinator", () => {
  it("connect issues the initial query a seeded selection implies", async () => {
    const { db, coordinator, run } = makeHarness();
    const selection = new Selection();
    selection.update(clausePoint("region", "West", { source: {} }));
    const client = connectClient(coordinator, run, [selection]);

    await vi.waitFor(() => expect(client.results).toEqual([[{ n: 1 }]]));
    expect(client.pendingCount).toBe(1);
    expect(db.queries).toEqual([
      { sql: "select * from (base) where region = ?", params: ["West"] },
    ]);
  });

  it("connect issues no query when the selections compose no predicate", async () => {
    const { db, coordinator, run } = makeHarness();
    const client = connectClient(coordinator, run, [new Selection()]);

    await tick();
    expect(client.pendingCount).toBe(0);
    expect(db.queries).toEqual([]);
  });

  it("publish re-queries every client in the selection's group", async () => {
    const { db, coordinator, run } = makeHarness();
    const selection = new Selection();
    const first = connectClient(coordinator, run, [selection]);
    const second = connectClient(coordinator, run, [selection]);

    await publish(
      selection,
      clausePoint("region", "West", { source: {} }),
      () => expect(first.results).toHaveLength(1),
    );
    expect(second.results).toHaveLength(1);
    expect(db.queries).toEqual([
      { sql: "select * from (base) where region = ?", params: ["West"] },
      { sql: "select * from (base) where region = ?", params: ["West"] },
    ]);
  });

  it("does not re-query clients outside the published selection's group", async () => {
    const { db, coordinator, run } = makeHarness();
    const client = connectClient(coordinator, run, [new Selection()]);
    await tick();

    new Selection().update(clausePoint("amount", 10, { source: {} }));
    await tick();
    expect(client.pendingCount).toBe(0);
    expect(db.queries).toEqual([]);
  });

  it("composes a client's selections conjunctively on a publish", async () => {
    const { coordinator, run } = makeHarness();
    const region = new Selection();
    const amount = new Selection();
    const client = connectClient(coordinator, run, [region, amount]);

    await publish(
      amount,
      clauseInterval("amount", [10, undefined], { source: {} }),
      () => expect(client.results).toHaveLength(1),
    );
    await publish(region, clausePoint("region", "West", { source: {} }), () =>
      expect(client.results).toHaveLength(2),
    );

    expect(client.asked[1]).toEqual({
      sql: "(region = ?) AND (amount >= ?)",
      params: ["West", 10],
    });
  });

  it("skips a client the published clause names and re-queries the others", async () => {
    const { db, coordinator, run } = makeHarness();
    const selection = Selection.crossfilter();
    const publisher = connectClient(coordinator, run, [selection]);
    const other = connectClient(coordinator, run, [selection]);

    selection.update(
      clausePoint("region", "West", {
        source: {},
        clients: new Set([publisher]),
      }),
    );
    await vi.waitFor(() => expect(other.results).toHaveLength(1));

    expect(publisher.pendingCount).toBe(0);
    expect(publisher.asked).toEqual([]);
    expect(db.queries).toEqual([
      { sql: "select * from (base) where region = ?", params: ["West"] },
    ]);
  });

  it("re-queries with the replacement clause when a source republishes", async () => {
    const { db, coordinator, run } = makeHarness();
    const selection = new Selection();
    const client = connectClient(coordinator, run, [selection]);
    const source = {};

    await publish(selection, clausePoint("region", "West", { source }), () =>
      expect(client.results).toHaveLength(1),
    );
    await publish(selection, clausePoint("region", "East", { source }), () =>
      expect(client.results).toHaveLength(2),
    );

    expect(db.queries[1]).toEqual({
      sql: "select * from (base) where region = ?",
      params: ["East"],
    });
  });

  it("issues no query when a clear leaves nothing composed", async () => {
    const { db, coordinator, run } = makeHarness();
    const selection = new Selection();
    const source = {};
    selection.update(clauseList("region", ["West", "East"], { source }));
    const client = connectClient(coordinator, run, [selection]);
    await vi.waitFor(() => expect(client.results).toHaveLength(1));

    selection.update(clauseNone(source));
    await tick();

    expect(db.queries).toHaveLength(1);
    expect(client.results).toHaveLength(1);
  });

  it("re-queries the surviving composition when one of two selections clears", async () => {
    const { coordinator, run } = makeHarness();
    const region = new Selection();
    const amount = new Selection();
    amount.update(clauseInterval("amount", [10, undefined], { source: {} }));
    const client = connectClient(coordinator, run, [region, amount]);
    await vi.waitFor(() => expect(client.results).toHaveLength(1));
    const regionSource = {};

    await publish(
      region,
      clausePoint("region", "West", { source: regionSource }),
      () => expect(client.results).toHaveLength(2),
    );
    region.update(clauseNone(regionSource));
    await vi.waitFor(() => expect(client.results).toHaveLength(3));

    expect(client.asked[2]).toEqual({ sql: "amount >= ?", params: [10] });
  });

  it("aborts an in-flight query when a newer publish arrives", async () => {
    const { db, held, selection, client, source } = await heldClient();
    expect(db.queries).toHaveLength(1);
    expect(client.results).toEqual([]);

    selection.update(clausePoint("region", "East", { source }));
    await tick();
    expect(db.queries).toHaveLength(2);

    held.get("East")?.([{ n: 2 }]);
    await vi.waitFor(() => expect(client.results).toEqual([[{ n: 2 }]]));

    held.get("West")?.([{ n: 1 }]);
    await tick();
    expect(client.results).toEqual([[{ n: 2 }]]);
    expect(client.errors).toEqual([]);
  });

  it("reports a failing query through queryError", async () => {
    const { coordinator, run } = makeHarness(
      FakeDuckDb.failing("binder error"),
    );
    const selection = new Selection();
    const client = connectClient(coordinator, run, [selection]);

    await publish(
      selection,
      clausePoint("region", "West", { source: {} }),
      () => expect(client.errors).toHaveLength(1),
    );

    expect(client.errors[0]).toContain("binder error");
    expect(client.results).toEqual([]);
  });

  it("disconnect stops re-querying and abandons the in-flight query", async () => {
    const { db, held, coordinator, selection, client, source } =
      await heldClient();
    coordinator.disconnect(client);
    held.get("West")?.([{ n: 1 }]);
    await tick();

    expect(client.results).toEqual([]);
    selection.update(clausePoint("region", "East", { source }));
    await tick();
    expect(db.queries).toHaveLength(1);
  });

  it("disconnect is a no-op for an unknown client", () => {
    const { coordinator } = makeHarness();
    expect(() => coordinator.disconnect(new FakeClient())).not.toThrow();
  });

  it("throws when a client connects twice", () => {
    const { coordinator, run } = makeHarness();
    const selection = new Selection();
    const client = connectClient(coordinator, run, [selection]);
    expect(() => coordinator.connect(client, [selection], run)).toThrow(
      "Client already connected.",
    );
  });

  it("runs nothing when the client declines to build a query", async () => {
    const { db, coordinator, run } = makeHarness();
    const selection = new Selection();
    selection.update(clauseList("region", ["West", "East"], { source: {} }));
    const client = connectClient(
      coordinator,
      run,
      [selection],
      new FakeClient(true),
    );

    await tick();
    expect(client.pendingCount).toBe(0);
    expect(db.queries).toEqual([]);
  });

  it("maps a rejecting runner to queryError", async () => {
    const { coordinator } = makeHarness();
    const run = () => Promise.reject(new Error("runtime gone"));
    const selection = new Selection();
    selection.update(clauseInterval("amount", [10, undefined], { source: {} }));
    const client = connectClient(coordinator, run, [selection]);

    await vi.waitFor(() => expect(client.errors).toEqual(["runtime gone"]));
  });

  it("leaves the client pending when the runner reports loading", async () => {
    const { coordinator } = makeHarness();
    const run = (): Promise<QueryResult> =>
      Promise.resolve({ status: "loading" });
    const selection = new Selection();
    const client = connectClient(coordinator, run, [selection]);

    selection.update(clausePoint("region", "West", { source: {} }));
    await tick();

    expect(client.pendingCount).toBe(1);
    expect(client.results).toEqual([]);
    expect(client.errors).toEqual([]);
  });
});
