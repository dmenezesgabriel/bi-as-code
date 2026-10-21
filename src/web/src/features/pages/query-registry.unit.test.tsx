import { StrictMode, useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Layer } from "effect";
import { DuckDb } from "../data/data-service";
import { FakeDuckDb } from "../data/fake-duckdb";
import { DataRuntimeProvider } from "../data/runtime";
import { FakeDataUpdates } from "./fake-data-updates";
import {
  QueryRegistryProvider,
  useQueryResults,
  useQuerySource,
  type QuerySource,
} from "./query-registry";
import type {
  QueryResult,
  SqlBlock,
  SqlTableMap,
  TranslationMap,
} from "./types";

type Results = Readonly<Record<string, QueryResult>>;

function ResultsProbe({ onChange }: { onChange: (results: Results) => void }) {
  const results = useQueryResults();
  useEffect(() => {
    onChange(results);
  }, [results, onChange]);
  return null;
}

/** Records every `QuerySource` the provider hands its consumers. */
function SourceProbe({ sources }: { sources: QuerySource[] }) {
  const source = useQuerySource();
  useEffect(() => {
    sources.push(source);
  }, [source, sources]);
  return null;
}

function renderRegistry({
  blocks = [] as SqlBlock[],
  tables = {} as SqlTableMap,
  params = {} as Record<string, unknown>,
  translations = undefined as TranslationMap | undefined,
  db = new FakeDuckDb(),
  strict = false,
  dataUpdates = undefined as FakeDataUpdates | undefined,
} = {}) {
  const resultsRef: { current: Results } = { current: {} };
  const layer = Layer.succeed(DuckDb, db);
  const tree = (p: Record<string, unknown>, t = translations) => (
    <DataRuntimeProvider layer={layer}>
      <QueryRegistryProvider
        sqlBlocks={blocks}
        sqlTables={tables}
        params={p}
        translations={t}
        dataUpdates={dataUpdates?.subscription}
      >
        <ResultsProbe onChange={(r) => (resultsRef.current = r)} />
      </QueryRegistryProvider>
    </DataRuntimeProvider>
  );
  const rendered = render(
    strict ? <StrictMode>{tree(params)}</StrictMode> : tree(params),
  );
  return {
    db,
    resultsRef,
    rerenderParams: (p: Record<string, unknown>) => rendered.rerender(tree(p)),
    rerenderTranslations: (t: TranslationMap) =>
      rendered.rerender(tree(params, t)),
    unmount: rendered.unmount,
  };
}

describe("QueryRegistryProvider", () => {
  it("registers each sql table once and exposes every block's rows", async () => {
    const { db, resultsRef } = renderRegistry({
      blocks: [
        { name: "orders", sql: "select * from orders" },
        { name: "trend", sql: "select * from {{orders}}" },
      ],
      tables: { orders: "data/orders.parquet" },
    });

    await waitFor(() => {
      expect(resultsRef.current.orders).toEqual({
        status: "success",
        rows: [{ n: 1 }],
      });
      expect(resultsRef.current.trend?.status).toBe("success");
    });
    expect(db.registered).toEqual([
      { name: "orders", source: "data/orders.parquet" },
    ]);
    expect(db.queries.map((q) => q.sql)).toEqual([
      "select * from orders",
      "select * from (select * from orders)",
    ]);
  });

  it("registers the source-set only once across a StrictMode remount", async () => {
    const { db, resultsRef } = renderRegistry({
      strict: true,
      blocks: [{ name: "q", sql: "select 1" }],
      tables: { orders: "data/orders.csv" },
    });

    await waitFor(() => expect(resultsRef.current.q?.status).toBe("success"));
    expect(db.registered).toEqual([
      { name: "orders", source: "data/orders.csv" },
    ]);
  });

  it("re-registers the tables on a fresh page mount", async () => {
    const db = new FakeDuckDb();
    const first = renderRegistry({
      db,
      blocks: [{ name: "q", sql: "select 1" }],
      tables: { orders: "data/orders.csv" },
    });
    await waitFor(() =>
      expect(first.resultsRef.current.q?.status).toBe("success"),
    );
    first.unmount();

    const second = renderRegistry({
      db,
      blocks: [{ name: "q", sql: "select 1" }],
      tables: { orders: "data/orders.csv" },
    });
    await waitFor(() =>
      expect(second.resultsRef.current.q?.status).toBe("success"),
    );

    expect(db.registered).toHaveLength(2);
  });

  it("binds {{params.*}} through prepared args from the params prop", async () => {
    const { db, resultsRef } = renderRegistry({
      blocks: [
        {
          name: "q",
          sql: "select * from orders where region = {{params.region}}",
        },
      ],
      params: { region: "West" },
    });

    await waitFor(() => expect(resultsRef.current.q?.status).toBe("success"));
    expect(db.queries).toEqual([
      { sql: "select * from orders where region = ?", params: ["West"] },
    ]);
  });

  it("binds {{$translations.*}} through prepared args from the translations prop", async () => {
    const { db, resultsRef } = renderRegistry({
      blocks: [
        {
          name: "q",
          sql: "select * from labels where label = {{$translations.west}}",
        },
      ],
      translations: { west: "l'Ouest" },
    });

    await waitFor(() => expect(resultsRef.current.q?.status).toBe("success"));
    expect(db.queries).toEqual([
      { sql: "select * from labels where label = ?", params: ["l'Ouest"] },
    ]);
  });

  it("re-runs only the blocks that read a changed translation", async () => {
    const { db, resultsRef, rerenderTranslations } = renderRegistry({
      blocks: [
        { name: "total", sql: "select count(*) from orders" },
        { name: "q", sql: "select {{$translations.west}} as label" },
      ],
      translations: { west: "West" },
    });
    await waitFor(() => expect(resultsRef.current.q?.status).toBe("success"));

    rerenderTranslations({ west: "l'Ouest" });

    await waitFor(() => expect(db.queries).toHaveLength(3));
    expect(db.queries[2]).toEqual({
      sql: "select ? as label",
      params: ["l'Ouest"],
    });
  });

  it("re-runs queries when params change without re-registering tables", async () => {
    const { db, resultsRef, rerenderParams } = renderRegistry({
      blocks: [
        {
          name: "q",
          sql: "select * from orders where region = {{params.region}}",
        },
      ],
      tables: { orders: "data/orders.csv" },
      params: { region: "West" },
    });
    await waitFor(() => expect(resultsRef.current.q?.status).toBe("success"));

    rerenderParams({ region: "South" });

    await waitFor(() => expect(db.queries).toHaveLength(2));
    expect(db.queries[1]).toEqual({
      sql: "select * from orders where region = ?",
      params: ["South"],
    });
    expect(db.registered).toHaveLength(1);
  });

  it("re-runs only the blocks a param change reaches, keeping the others' results", async () => {
    const snapshots: Results[] = [];
    const { db, resultsRef, rerenderParams } = renderRegistry({
      blocks: [
        { name: "total", sql: "select count(*) from orders" },
        {
          name: "q",
          sql: "select * from orders where region = {{params.region}}",
        },
        { name: "inlined", sql: "select * from {{q}}" },
      ],
      params: { region: "West" },
    });
    await waitFor(() =>
      expect(resultsRef.current.inlined?.status).toBe("success"),
    );
    const settled = resultsRef.current.total;

    rerenderParams({ region: "South" });
    snapshots.push(resultsRef.current);
    await waitFor(() => expect(db.queries).toHaveLength(5));
    await waitFor(() =>
      expect(resultsRef.current.inlined?.status).toBe("success"),
    );

    expect(db.queries.slice(3).map((q) => q.params)).toEqual([
      ["South"],
      ["South"],
    ]);
    expect([...snapshots, resultsRef.current].map((r) => r.total)).toEqual([
      settled,
      settled,
    ]);
  });

  it("keeps an unchanged block's interpolated query identity across a param change", async () => {
    const sources: QuerySource[] = [];
    const layer = Layer.succeed(DuckDb, new FakeDuckDb());
    const tree = (region: string) => (
      <DataRuntimeProvider layer={layer}>
        <QueryRegistryProvider
          sqlBlocks={[
            { name: "total", sql: "select count(*) from orders" },
            { name: "q", sql: "select * from orders where r = {{params.r}}" },
          ]}
          sqlTables={{}}
          params={{ r: region }}
        >
          <SourceProbe sources={sources} />
        </QueryRegistryProvider>
      </DataRuntimeProvider>
    );
    const { rerender } = render(tree("West"));
    await waitFor(() =>
      expect(sources.some((s) => s.registered !== null)).toBe(true),
    );
    const before = sources.at(-1)?.interpolated;

    rerender(tree("South"));

    const after = sources.at(-1)?.interpolated;
    expect(after?.q?.params).toEqual(["South"]);
    expect(after?.total).toBe(before?.total);
    expect(after?.q).not.toBe(before?.q);
  });

  it("marks every block errored when registration fails, naming the source", async () => {
    const db = new FakeDuckDb();
    db.registerCause = new Error("HTTP 404");
    const { resultsRef } = renderRegistry({
      db,
      blocks: [
        { name: "a", sql: "select 1" },
        { name: "b", sql: "select 2" },
      ],
      tables: { orders: "data/missing.csv" },
    });

    await waitFor(() => {
      expect(resultsRef.current.a?.status).toBe("error");
      expect(resultsRef.current.b?.status).toBe("error");
    });
    expect(
      resultsRef.current.a?.status === "error" && resultsRef.current.a.message,
    ).toContain("orders ← data/missing.csv");
    expect(db.queries).toEqual([]);
  });

  it("errors only the failing block, leaving siblings successful", async () => {
    const db = new FakeDuckDb();
    db.failWhen = (sql) => (sql.includes("bad_table") ? "no such table" : null);
    const { resultsRef } = renderRegistry({
      db,
      blocks: [
        { name: "good", sql: "select 1" },
        { name: "bad", sql: "select * from bad_table" },
      ],
    });

    await waitFor(() => {
      expect(resultsRef.current.good?.status).toBe("success");
      expect(resultsRef.current.bad?.status).toBe("error");
    });
    expect(
      resultsRef.current.bad?.status === "error" &&
        resultsRef.current.bad.message,
    ).toContain("no such table");
  });

  it("names a broken query file ahead of its error, but not in a fence built on it", async () => {
    const db = new FakeDuckDb();
    db.failWhen = (sql) => (sql.includes("selec ") ? "syntax error" : null);
    const { resultsRef } = renderRegistry({
      db,
      blocks: [
        { name: "/queries/region_orders", sql: "selec region from orders" },
        { name: "share", sql: "select * from {{/queries/region_orders}}" },
      ],
    });

    await waitFor(() => {
      expect(resultsRef.current["/queries/region_orders"]?.status).toBe(
        "error",
      );
      expect(resultsRef.current.share?.status).toBe("error");
    });
    expect(resultsRef.current["/queries/region_orders"]).toMatchObject({
      message: expect.stringMatching(
        /^queries\/region_orders\.sql: .*syntax error/,
      ),
    });
    expect(resultsRef.current.share).toMatchObject({
      message: expect.not.stringMatching(/^queries\//),
    });
  });

  it("surfaces interpolation errors without sending the query", async () => {
    const { db, resultsRef } = renderRegistry({
      blocks: [{ name: "q", sql: "select * from {{nope}}" }],
    });

    await waitFor(() => expect(resultsRef.current.q?.status).toBe("error"));
    expect(
      resultsRef.current.q?.status === "error" && resultsRef.current.q.message,
    ).toContain("nope");
    expect(db.queries).toEqual([]);
  });

  it("exposes each block's interpolated sql and the registration gate", async () => {
    const sources: QuerySource[] = [];
    render(
      <DataRuntimeProvider layer={Layer.succeed(DuckDb, new FakeDuckDb())}>
        <QueryRegistryProvider
          sqlBlocks={[
            { name: "q", sql: "select * from orders where r = {{params.r}}" },
          ]}
          sqlTables={{}}
          params={{ r: "West" }}
        >
          <SourceProbe sources={sources} />
        </QueryRegistryProvider>
      </DataRuntimeProvider>,
    );

    await waitFor(() =>
      expect(sources.some((s) => s.registered !== null)).toBe(true),
    );
    const source = sources.at(-1);
    expect(source?.interpolated.q?.sql).toBe(
      "select * from orders where r = ?",
    );
    expect(source?.interpolated.q?.params).toEqual(["West"]);
  });
});

describe("QueryRegistryProvider data updates", () => {
  const blocks = [{ name: "q", sql: "select * from orders" }];
  const tables = { orders: "data/orders.csv" };

  async function renderSettled(db = new FakeDuckDb()) {
    const dataUpdates = new FakeDataUpdates();
    const rendered = renderRegistry({ db, blocks, tables, dataUpdates });
    await waitFor(() =>
      expect(rendered.resultsRef.current.q?.status).not.toBe("loading"),
    );
    return { ...rendered, dataUpdates };
  }

  it("re-registers the tables and re-runs the blocks when a source it reads changes", async () => {
    const { db, resultsRef, dataUpdates } = await renderSettled();
    db.rows = [{ n: 2 }];

    act(() => dataUpdates.emit({ path: "data/orders.csv", version: 2 }));

    await waitFor(() =>
      expect(resultsRef.current.q).toEqual({
        status: "success",
        rows: [{ n: 2 }],
      }),
    );
    expect(db.registered).toHaveLength(2);
    expect(db.queries).toHaveLength(2);
  });

  it("ignores a change to a file the page does not read", async () => {
    const { db, dataUpdates } = await renderSettled();

    act(() => dataUpdates.emit({ path: "data/flights.parquet", version: 2 }));

    // A matching path registers within a macrotask (see the test above).
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(db.registered).toHaveLength(1);
    expect(db.queries).toHaveLength(1);
  });

  it("recovers from a failed registration once the source changes again", async () => {
    const db = new FakeDuckDb();
    db.registerCause = new Error("HTTP 500");
    const { resultsRef, dataUpdates } = await renderSettled(db);
    expect(resultsRef.current.q?.status).toBe("error");
    db.registerCause = null;

    act(() => dataUpdates.emit({ path: "data/orders.csv", version: 2 }));

    await waitFor(() => expect(resultsRef.current.q?.status).toBe("success"));
  });

  it("unsubscribes on unmount", async () => {
    const { dataUpdates, unmount } = await renderSettled();
    expect(dataUpdates.listenerCount).toBe(1);

    unmount();

    expect(dataUpdates.listenerCount).toBe(0);
  });
});
