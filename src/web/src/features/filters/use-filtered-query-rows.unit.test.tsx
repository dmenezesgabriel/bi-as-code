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
import type { FilterIds } from "./filter-ids";
import type { Filters } from "./filters";
import { FiltersProvider, usePageFilters } from "./page-filters-context";
import type { QueryShape } from "../crossfilter/types";
import {
  useFilteredQueryClient,
  useFilteredQueryRows,
} from "./use-filtered-query-rows";

const ORDERS_BLOCK: SqlBlock = { name: "orders", sql: "select * from orders" };
const OPTS_BLOCK: SqlBlock = { name: "opts", sql: "select * from opts" };
const WRAPPED = "select * from (select * from orders) where region = ?";

function FilteredProbe({
  name,
  filters,
  owner,
  shape,
  onEmit,
  onFilters,
}: {
  name: string;
  filters: FilterIds | undefined;
  owner?: string;
  shape?: QueryShape;
  onEmit: (result: QueryResult | undefined, filtered: boolean) => void;
  onFilters: (filters: Filters | undefined) => void;
}) {
  const pageFilters = usePageFilters();
  // A fresh closure every render — the hook must not reconnect on it.
  const freshShape: QueryShape | undefined = shape
    ? (block, predicate) => shape(block, predicate)
    : undefined;
  const { result, filtered } = useFilteredQueryClient(
    name,
    filters,
    owner,
    freshShape,
  );
  useEffect(() => {
    onEmit(result, filtered);
  }, [result, filtered, onEmit]);
  useEffect(() => {
    onFilters(pageFilters);
  }, [pageFilters, onFilters]);
  return null;
}

function renderFiltered({
  blocks = [],
  tables = {},
  params = {},
  url,
  db = new FakeDuckDb(),
  name = "orders",
  filters = ["region"],
  owner,
  shape,
}: {
  blocks?: SqlBlock[];
  tables?: SqlTableMap;
  params?: Record<string, unknown>;
  url?: string;
  db?: FakeDuckDb;
  name?: string;
  filters?: FilterIds;
  owner?: string;
  shape?: QueryShape;
} = {}) {
  const emitted: (QueryResult | undefined)[] = [];
  const filteredFlags: boolean[] = [];
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
            filters={filters}
            owner={owner}
            shape={shape}
            onEmit={(result, filtered) => {
              emitted.push(result);
              filteredFlags.push(filtered);
            }}
            onFilters={(filters) => {
              filtersRef.current = filters;
            }}
          />
        </FiltersProvider>
      </QueryRegistryProvider>
    </DataRuntimeProvider>
  );
  const view = render(tree);
  return {
    db,
    emitted,
    filtersRef,
    unmount: view.unmount,
    latest: () => emitted[emitted.length - 1],
    latestFiltered: () => filteredFlags[filteredFlags.length - 1],
  };
}

/**
 * Two consumers on the same page: `opts` consumes the `region` selection as
 * the publishing input's own client (`owner="region"`), `orders` as a plain
 * one — the arrangement the cross-filter tests compare.
 */
function renderOwnerVsConsumer({ url, db }: { url?: string; db: FakeDuckDb }) {
  const emittedOpts: (QueryResult | undefined)[] = [];
  const emittedOrders: (QueryResult | undefined)[] = [];
  const filtersRef: { current: Filters | undefined } = { current: undefined };
  render(
    <DataRuntimeProvider layer={Layer.succeed(DuckDb, db)}>
      <QueryRegistryProvider
        sqlBlocks={[ORDERS_BLOCK, OPTS_BLOCK]}
        sqlTables={{
          orders: "data/orders.parquet",
          opts: "data/opts.parquet",
        }}
        params={{}}
      >
        <FiltersProvider port={new FakeFilterUrlPort(url)}>
          <FilteredProbe
            name="opts"
            filters={["region"]}
            owner="region"
            onEmit={(result) => {
              emittedOpts.push(result);
            }}
            onFilters={(filters) => {
              filtersRef.current = filters;
            }}
          />
          <FilteredProbe
            name="orders"
            filters={["region"]}
            onEmit={(result) => {
              emittedOrders.push(result);
            }}
            onFilters={() => {}}
          />
        </FiltersProvider>
      </QueryRegistryProvider>
    </DataRuntimeProvider>,
  );
  return {
    filtersRef,
    latestOpts: () => emittedOpts[emittedOpts.length - 1],
    latestOrders: () => emittedOrders[emittedOrders.length - 1],
  };
}

const wrappedOptsQueries = (db: FakeDuckDb) =>
  db.queries.filter(
    (q) => q.sql !== "select * from opts" && q.sql.includes("opts"),
  );

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

  it("accepts a lone string id as the authoring shape", async () => {
    const db = new FakeDuckDb();
    const { latest } = renderFiltered({
      db,
      url: "?region=West",
      blocks: [ORDERS_BLOCK],
      filters: "region",
    });

    await waitFor(() => expect(latest()?.status).toBe("success"));
    expect(db.queries).toContainEqual({ sql: WRAPPED, params: ["West"] });
  });

  it("runs no wrapped query for an empty id list", async () => {
    const db = new FakeDuckDb();
    const { latest } = renderFiltered({
      db,
      url: "?region=West",
      blocks: [ORDERS_BLOCK],
      filters: [],
    });

    await waitFor(() => expect(latest()?.status).toBe("success"));
    expect(db.queries).toEqual([{ sql: "select * from orders", params: [] }]);
  });

  it("and-composes every contributing filter's predicate", async () => {
    const db = new FakeDuckDb();
    const { latest } = renderFiltered({
      db,
      url: "?region=West&channel=online",
      blocks: [ORDERS_BLOCK],
      filters: ["region", "channel"],
    });

    await waitFor(() => expect(latest()?.status).toBe("success"));
    expect(db.queries).toContainEqual({
      sql: "select * from (select * from orders) where (region = ?) AND (channel = ?)",
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

  it("returns to the registry result when the only contributing filter clears", async () => {
    const db = FakeDuckDb.withRowsWhen([{ n: 1 }], (sql) =>
      sql === WRAPPED ? [{ region: "West" }] : null,
    );
    const { latest, filtersRef } = renderFiltered({
      db,
      url: "?region=West",
      blocks: [ORDERS_BLOCK],
    });
    await waitFor(() =>
      expect(latest()).toEqual({
        status: "success",
        rows: [{ region: "West" }],
      }),
    );
    const issued = db.queries.length;

    act(() => filtersRef.current?.get("region")?.applySerialized(""));

    // The clause clears; no callback runs and no second query is issued —
    // the render falls back to the registry's already-loaded result.
    await waitFor(() =>
      expect(latest()).toEqual({ status: "success", rows: [{ n: 1 }] }),
    );
    expect(db.queries).toHaveLength(issued);
  });

  it("stops re-querying once the consumer unmounts", async () => {
    const db = new FakeDuckDb();
    const { filtersRef, unmount } = renderFiltered({
      db,
      url: "?region=West",
      blocks: [ORDERS_BLOCK],
    });
    await waitFor(() =>
      expect(db.queries).toContainEqual({ sql: WRAPPED, params: ["West"] }),
    );

    unmount();
    const issued = db.queries.length;
    await act(async () => {
      filtersRef.current?.get("region")?.applySerialized("South");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(db.queries).toHaveLength(issued);
  });

  it("skips the owner client's own publish while another consumer narrows", async () => {
    const db = new FakeDuckDb();
    const { filtersRef, latestOpts, latestOrders } = renderOwnerVsConsumer({
      db,
    });
    await waitFor(() => expect(latestOrders()?.status).toBe("success"));

    act(() => filtersRef.current?.get("region")?.applySerialized("West"));

    await waitFor(() =>
      expect(db.queries).toContainEqual({ sql: WRAPPED, params: ["West"] }),
    );
    expect(wrappedOptsQueries(db)).toEqual([]);
    expect(latestOpts()).toEqual({ status: "success", rows: [{ n: 1 }] });
  });

  it("never issues the owner client's wrapped query for a URL-seeded own pick", async () => {
    const db = new FakeDuckDb();
    const { latestOpts, latestOrders } = renderOwnerVsConsumer({
      url: "?region=West",
      db,
    });

    await waitFor(() =>
      expect(db.queries).toContainEqual({ sql: WRAPPED, params: ["West"] }),
    );
    expect(wrappedOptsQueries(db)).toEqual([]);
    expect(latestOpts()).toEqual({ status: "success", rows: [{ n: 1 }] });
    expect(latestOrders()?.status).toBe("success");
  });
});

describe("useFilteredQueryClient query shape", () => {
  const COUNTED =
    "select count(*) as n from (select * from orders) where region = ?";
  const countShape: QueryShape = (block, predicate) => ({
    sql: `select count(*) as n from (${block.sql}) where ${predicate.sql}`,
    params: [...block.params, ...predicate.params],
    errors: [],
  });

  it("runs the widget's shape in place of the plain wrap", async () => {
    const db = new FakeDuckDb();
    const { latest, latestFiltered } = renderFiltered({
      db,
      url: "?region=West",
      blocks: [ORDERS_BLOCK],
      shape: countShape,
    });

    await waitFor(() => expect(latest()?.status).toBe("success"));

    expect(db.queries).toContainEqual({ sql: COUNTED, params: ["West"] });
    expect(db.queries.map((q) => q.sql)).not.toContain(WRAPPED);
    expect(latestFiltered()).toBe(true);
  });

  it("flags the registry result as unfiltered", async () => {
    const { latest, latestFiltered } = renderFiltered({
      blocks: [ORDERS_BLOCK],
      shape: countShape,
    });

    await waitFor(() => expect(latest()?.status).toBe("success"));

    expect(latestFiltered()).toBe(false);
  });

  it("issues the shaped query once although the shape closure is fresh each render", async () => {
    const db = new FakeDuckDb();
    const { latest } = renderFiltered({
      db,
      url: "?region=West",
      blocks: [ORDERS_BLOCK],
      shape: countShape,
    });

    await waitFor(() => expect(latest()?.status).toBe("success"));

    expect(db.queries.filter((q) => q.sql === COUNTED)).toHaveLength(1);
  });
});
