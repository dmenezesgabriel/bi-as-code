import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { DuckDb } from "../../data/data-service";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { DataRuntimeProvider } from "../../data/runtime";
import type { Row } from "../../data/types";
import { QueryRegistryProvider } from "../../pages/query-registry";
import type { SqlBlock } from "../../pages/types";
import { Table } from "./table";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

/**
 * Renders `<Table>` exactly as a compiled page does: the component map
 * mounts it inside the page's `QueryRegistryProvider`, which is why a fake
 * `DuckDb` — not seeded props — decides which result `data` resolves to.
 */
function renderTable({
  db = new FakeDuckDb(),
  blocks = [ORDERS],
  data = "orders",
  pageSize,
  provider = true,
}: {
  db?: FakeDuckDb;
  blocks?: SqlBlock[];
  data?: string;
  pageSize?: number;
  provider?: boolean;
} = {}) {
  const element = <Table data={data} pageSize={pageSize} />;
  render(
    provider ? (
      <DataRuntimeProvider layer={Layer.succeed(DuckDb, db)}>
        <QueryRegistryProvider sqlBlocks={blocks} sqlTables={{}} params={{}}>
          {element}
        </QueryRegistryProvider>
      </DataRuntimeProvider>
    ) : (
      element
    ),
  );
  return db;
}

describe("Table", () => {
  it("renders the named query's rows as a sortable, paginated table", async () => {
    const db = new FakeDuckDb();
    db.rows = [
      { region: "West", orders: 140 },
      { region: "North", orders: 120 },
    ];
    renderTable({ db });

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(
      screen.getAllByRole("columnheader").map((th) => th.textContent),
    ).toEqual(["region", "orders"]);
    expect(screen.getByRole("cell", { name: "West" })).toBeInTheDocument();
  });

  it("pages at 10 rows by default", async () => {
    const db = new FakeDuckDb();
    db.rows = Array.from({ length: 12 }, (_, i) => ({ n: i + 1 }));
    renderTable({ db });

    expect(await screen.findByText("Page 1 of 2 · 12 rows")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(11);
  });

  it("honors a pageSize prop", async () => {
    const db = new FakeDuckDb();
    db.rows = Array.from({ length: 6 }, (_, i) => ({ n: i + 1 }));
    renderTable({ db, pageSize: 5 });

    expect(await screen.findByText("Page 1 of 2 · 6 rows")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(6);
  });

  it("shows a loading skeleton while the query is in flight", async () => {
    const db = new FakeDuckDb();
    db.queryRows = () => Effect.promise(() => new Promise<Row[]>(() => {}));
    renderTable({ db });

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an inline error naming the query when the query fails", async () => {
    const db = new FakeDuckDb();
    db.failWhen = () => "Catalog Error: Table orders does not exist";
    renderTable({ db });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("orders");
    expect(alert).toHaveTextContent("Table orders does not exist");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the empty state when the named query returns no rows", async () => {
    const db = new FakeDuckDb();
    db.rows = [];
    renderTable({ db });

    expect(await screen.findByText("0 rows")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an inline alert naming a data value no sql block declares", async () => {
    renderTable({ data: "ghost" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ghost");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the same unknown-name alert outside a query registry", async () => {
    renderTable({ provider: false });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("orders");
  });

  it("sorts and pages without re-querying the registry", async () => {
    const db = new FakeDuckDb();
    db.rows = Array.from({ length: 12 }, (_, i) => ({ n: i + 1 }));
    renderTable({ db });

    await screen.findByText("Page 1 of 2 · 12 rows");
    fireEvent.click(screen.getByRole("button", { name: "n" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("Page 2 of 2 · 12 rows")).toBeVisible();
    expect(db.queries).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getAllByRole("columnheader")[0]).toHaveAttribute(
        "aria-sort",
        "descending",
      ),
    );
  });
});
