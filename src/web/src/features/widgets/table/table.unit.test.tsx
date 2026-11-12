import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterIds } from "../../filters/filter-ids";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import type { SqlBlock } from "../../pages/types";
import { renderWithRegistry } from "../value/registry-harness";
import { Column } from "./column";
import { saveCsv } from "./save-csv";
import { Table } from "./table";

vi.mock("./save-csv", () => ({ saveCsv: vi.fn() }));

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

/**
 * Renders `<Table>` exactly as a compiled page does: the component map
 * mounts it inside the page's `QueryRegistryProvider`, which is why a fake
 * `DuckDb` — not seeded props — decides which result `data` resolves to.
 * `url` seeds a page filter for the `filters`-prop tests.
 */
function renderTable({
  db = new FakeDuckDb(),
  blocks = [ORDERS],
  data = "orders",
  pageSize,
  provider = true,
  filters,
  url,
  children,
}: {
  db?: FakeDuckDb;
  blocks?: SqlBlock[];
  data?: string;
  pageSize?: number;
  provider?: boolean;
  filters?: FilterIds;
  url?: string;
  children?: ReactNode;
} = {}) {
  return renderWithRegistry(
    <Table data={data} pageSize={pageSize} filters={filters}>
      {children}
    </Table>,
    { db, blocks, provider, url },
  );
}

describe("Table", () => {
  beforeEach(() => {
    vi.mocked(saveCsv).mockClear();
  });

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
    ).toEqual(["Region", "Orders"]);
    expect(screen.getByRole("cell", { name: "West" })).toBeInTheDocument();
  });

  it("downloads the named query's rows as <data>.csv", async () => {
    const db = new FakeDuckDb();
    db.rows = [{ region: "West", orders: 140 }];
    renderTable({ db });

    fireEvent.click(
      await screen.findByRole("button", { name: "Download CSV" }),
    );

    expect(saveCsv).toHaveBeenCalledWith(
      "orders.csv",
      "\ufeffRegion,Orders\r\nWest,140",
    );
  });

  it("downloads under the <Column> titles when columns are chosen", async () => {
    const db = new FakeDuckDb();
    db.rows = [{ region: "West", orders: 140 }];
    renderTable({
      db,
      children: [<Column key="r" id="region" title="Area" />],
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Download CSV" }),
    );

    expect(saveCsv).toHaveBeenCalledWith("orders.csv", "\ufeffArea\r\nWest");
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

  it("wraps the fence with the declared filter's bound predicate", async () => {
    const db = new FakeDuckDb();
    db.rowsWhen = (sql) =>
      sql.includes("where region = ?")
        ? [{ region: "West", orders: 140 }]
        : [
            { region: "West", orders: 140 },
            { region: "North", orders: 120 },
          ];
    renderTable({ db, filters: "region", url: "?region=West" });

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "West" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "North" })).toBeNull();
    expect(db.queries).toContainEqual({
      sql: "select * from (select * from orders) where region = ?",
      params: ["West"],
    });
  });

  it("sorts and pages without re-querying the registry", async () => {
    const db = new FakeDuckDb();
    db.rows = Array.from({ length: 12 }, (_, i) => ({ n: i + 1 }));
    renderTable({ db });

    await screen.findByText("Page 1 of 2 · 12 rows");
    fireEvent.click(screen.getByRole("button", { name: "N" }));
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

  describe("with <Column> children", () => {
    const REVENUE = [
      { region: "West", revenue: 6100, share: 0.394 },
      { region: "North", revenue: 4800, share: 0.31 },
    ];

    // MDX emits carrier children as a bare array, which is what these mimic.
    const columnEls = (...specs: Parameters<typeof Column>[0][]) =>
      specs.map((spec) => <Column key={spec.id} {...spec} />);

    it("shows only the listed columns, in order, with their fmt and title", async () => {
      const db = new FakeDuckDb();
      db.rows = REVENUE;
      renderTable({
        db,
        children: columnEls(
          { id: "share", fmt: "pct1", title: "Share" },
          { id: "region" },
        ),
      });

      await screen.findByRole("table");
      expect(
        screen.getAllByRole("columnheader").map((th) => th.textContent),
      ).toEqual(["Share", "Region"]);
      expect(screen.getAllByRole("cell").map((td) => td.textContent)).toEqual([
        "39.4%",
        "West",
        "31.0%",
        "North",
      ]);
    });

    it("alerts, naming the available columns, for an id the result lacks", async () => {
      const db = new FakeDuckDb();
      db.rows = REVENUE;
      renderTable({ db, children: columnEls({ id: "revnue" }) });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        'orders: column "revnue" is not in the result — available: region, revenue, share',
      );
    });

    it("alerts for a fmt the column cannot take", async () => {
      const db = new FakeDuckDb();
      db.rows = REVENUE;
      renderTable({ db, children: columnEls({ id: "region", fmt: "usd" }) });

      expect(await screen.findByRole("alert")).toHaveTextContent('fmt="usd"');
    });

    it("alerts for a child that is not a <Column>", () => {
      renderTable({ children: [<p key="p">stray</p>] });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "orders: only accepts <Column> children",
      );
    });
  });
});
