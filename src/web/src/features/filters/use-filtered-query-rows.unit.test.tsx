import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { Layer } from "effect";
import { DuckDb } from "../data/data-service";
import { FakeDuckDb } from "../data/fake-duckdb";
import { DataRuntimeProvider } from "../data/runtime";
import type { Row } from "../data/types";
import { QueryRegistryProvider } from "../pages/query-registry";
import type { QueryResult, SqlBlock, SqlTableMap } from "../pages/types";
import { FakeFilterUrlPort } from "./fake-url-port";
import type { Filters } from "./filters";
import { FiltersProvider, usePageFilters } from "./page-filters-context";
import { useFilteredQueryRows } from "./use-filtered-query-rows";

const ORDERS_BLOCK: SqlBlock = { name: "orders", sql: "select * from orders" };
const WRAPPED = "select * from (select * from orders) where region = ?";

function FilteredProbe({
  name,
  filterIds,
  onEmit,
  onFilters,
}: {
  name: string;
  filterIds: readonly string[];
  onEmit: (result: QueryResult | undefined) => void;
  onFilters: (filters: Filters | undefined) => void;
}) {
  const filters = usePageFilters();
  const result = useFilteredQueryRows(name, filterIds);
  useEffect(() => {
    onEmit(result);
  }, [result, onEmit]);
  useEffect(() => {
    onFilters(filters);
  }, [filters, onFilters]);
  return null;
}

function renderFiltered({
  blocks = [],
  tables = {},
  params = {},
  url,
  db = new FakeDuckDb(),
  name = "orders",
  filterIds = ["region"],
}: {
  blocks?: SqlBlock[];
  tables?: SqlTableMap;
  params?: Record<string, unknown>;
  url?: string;
  db?: FakeDuckDb;
  name?: string;
  filterIds?: string[];
} = {}) {
  const emitted: (QueryResult | undefined)[] = [];
  const filtersRef: { current: Filters | undefined } = { current: undefined };
  const tree = (
    <DataRuntimeProvider layer={Layer.succeed(DuckDb, db)}>
      <QueryRegistryProvider
        sqlBlocks={blocks}
        sqlTables={tables}
        params={params}
      >
        <FiltersProvider port={new FakeFilterUrlPort(url)}>
          <FilteredProbe
            name={name}
            filterIds={filterIds}
            onEmit={(result) => {
              emitted.push(result);
            }}
            onFilters={(filters) => {
              filtersRef.current = filters;
            }}
          />
        </FiltersProvider>
      </QueryRegistryProvider>
    </DataRuntimeProvider>
  );
  render(tree);
  return {
    db,
    emitted,
    filtersRef,
    latest: () => emitted[emitted.length - 1],
  };
}

describe("useFilteredQueryRows", () => {
  it("reuses the registry result and issues no second query when no filter contributes", async () => {
    const db = new FakeDuckDb();
    const { latest } = renderFiltered({
      db,
      blocks: [ORDERS_BLOCK],
      tables: { orders: "data/orders.parquet" },
    });

    await waitFor(() => expect(latest()?.status).toBe("success"));
    expect(latest()).toEqual({ status: "success", rows: [{ n: 1 }] });
    expect(db.queries).toEqual([{ sql: "select * from orders", params: [] }]);
  });

  it("wraps the interpolated sql with the url-seeded filter's bound predicate", async () => {
    const db = new FakeDuckDb();
    const { latest } = renderFiltered({
      db,
      url: "?region=West",
      blocks: [ORDERS_BLOCK],
      tables: { orders: "data/orders.parquet" },
    });

    await waitFor(() => expect(latest()?.status).toBe("success"));
    expect(db.queries).toContainEqual({ sql: WRAPPED, params: ["West"] });
    expect(latest()).toEqual({ status: "success", rows: [{ n: 1 }] });
  });

  it("and-composes every contributing filter's predicate", async () => {
    const db = new FakeDuckDb();
    const { latest } = renderFiltered({
      db,
      url: "?region=West&channel=online",
      blocks: [ORDERS_BLOCK],
      filterIds: ["region", "channel"],
    });

    await waitFor(() => expect(latest()?.status).toBe("success"));
    expect(db.queries).toContainEqual({
      sql: "select * from (select * from orders) where region = ? AND channel = ?",
      params: ["West", "online"],
    });
  });

  it("keeps positional order: block params first, then predicate params", async () => {
    const db = new FakeDuckDb();
    const { latest } = renderFiltered({
      db,
      url: "?region=West",
      params: { min: 100 },
      blocks: [
        {
          name: "orders",
          sql: "select * from orders where amount > {{params.min}}",
        },
      ],
    });

    await waitFor(() => expect(latest()?.status).toBe("success"));
    expect(db.queries).toContainEqual({
      sql: "select * from (select * from orders where amount > ?) where region = ?",
      params: [100, "West"],
    });
  });

  it("re-runs with the new value when a filter changes", async () => {
    const db = new FakeDuckDb();
    const { latest, filtersRef } = renderFiltered({
      db,
      url: "?region=West",
      blocks: [ORDERS_BLOCK],
    });
    await waitFor(() =>
      expect(db.queries.some((q) => q.params[0] === "West")).toBe(true),
    );

    act(() => filtersRef.current?.get("region")?.applySerialized("South"));

    await waitFor(() => expect(latest()?.status).toBe("success"));
    expect(db.queries).toContainEqual({ sql: WRAPPED, params: ["South"] });
  });

  it("never lands the in-flight result of a filter change it cancelled", async () => {
    const db = new FakeDuckDb();
    const westRows: Row[] = [{ region: "West", n: 7 }];
    const west: { resolve: ((rows: Row[]) => void) | null } = { resolve: null };
    db.holdWhen = (sql, params) => {
      if (sql === WRAPPED && params[0] === "West") {
        return new Promise<Row[]>((resolve) => {
          west.resolve = resolve;
        });
      }
      return null;
    };
    const { emitted, latest, filtersRef } = renderFiltered({
      db,
      url: "?region=West",
      blocks: [ORDERS_BLOCK],
    });
    await waitFor(() => expect(west.resolve).not.toBeNull());

    act(() => filtersRef.current?.get("region")?.applySerialized("South"));
    await waitFor(() => expect(latest()?.status).toBe("success"));

    west.resolve?.(westRows);
    await waitFor(() =>
      expect(
        emitted.some((r) => r?.status === "success" && r.rows === westRows),
      ).toBe(false),
    );
  });

  it("degrades to the registry result outside a FiltersProvider", async () => {
    const db = new FakeDuckDb();
    const emitted: (QueryResult | undefined)[] = [];
    function BareProbe() {
      const result = useFilteredQueryRows("orders", ["region"]);
      useEffect(() => {
        emitted.push(result);
      }, [result]);
      return null;
    }
    render(
      <DataRuntimeProvider layer={Layer.succeed(DuckDb, db)}>
        <QueryRegistryProvider
          sqlBlocks={[ORDERS_BLOCK]}
          sqlTables={{}}
          params={{}}
        >
          <BareProbe />
        </QueryRegistryProvider>
      </DataRuntimeProvider>,
    );

    await waitFor(() =>
      expect(emitted[emitted.length - 1]?.status).toBe("success"),
    );
    expect(db.queries).toEqual([{ sql: "select * from orders", params: [] }]);
  });

  it("returns undefined for a name no block declares", () => {
    const { latest } = renderFiltered({ blocks: [] });
    expect(latest()).toBeUndefined();
  });

  it("surfaces the registry's interpolation error without issuing a wrapped query", async () => {
    const db = new FakeDuckDb();
    const { latest } = renderFiltered({
      db,
      url: "?region=West",
      blocks: [{ name: "orders", sql: "select * from {{nope}}" }],
    });

    await waitFor(() => expect(latest()?.status).toBe("error"));
    const result = latest();
    expect(result?.status === "error" && result.message).toContain("nope");
    expect(db.queries).toEqual([]);
  });
});
