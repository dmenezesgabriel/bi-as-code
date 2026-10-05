import { StrictMode, useEffect } from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Layer } from "effect";
import { DuckDb } from "../data/data-service";
import { FakeDuckDb } from "../data/fake-duckdb";
import { DataRuntimeProvider } from "../data/runtime";
import { QueryRegistryProvider, useQueryResults } from "./query-registry";
import type { QueryResult, SqlBlock, SqlTableMap } from "./types";

type Results = Readonly<Record<string, QueryResult>>;

function ResultsProbe({ onChange }: { onChange: (results: Results) => void }) {
  const results = useQueryResults();
  useEffect(() => {
    onChange(results);
  }, [results, onChange]);
  return null;
}

function renderRegistry({
  blocks = [] as SqlBlock[],
  tables = {} as SqlTableMap,
  params = {} as Record<string, unknown>,
  db = new FakeDuckDb(),
  strict = false,
} = {}) {
  const resultsRef: { current: Results } = { current: {} };
  const layer = Layer.succeed(DuckDb, db);
  const tree = (p: Record<string, unknown>) => (
    <DataRuntimeProvider layer={layer}>
      <QueryRegistryProvider sqlBlocks={blocks} sqlTables={tables} params={p}>
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
});
