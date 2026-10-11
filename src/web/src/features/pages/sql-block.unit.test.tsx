import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { DuckDb } from "../data/data-service";
import { FakeDuckDb } from "../data/fake-duckdb";
import { DataRuntimeProvider } from "../data/runtime";
import type { Row } from "../data/types";
import { QueryRegistryProvider } from "./query-registry";
import { SqlBlockPre } from "./sql-block";
import type { SqlBlock } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

/**
 * Renders one fence exactly as a compiled page does: `<pre>` children come
 * from MDX, where a named sql block carries its name in the code element's
 * `meta` prop and each display flag that is on as an empty-string prop
 * (compile-page emits them via hast `hProperties`). Both flags default on,
 * so the result-state tests read as a fully shown block.
 */
function renderFence({
  db = new FakeDuckDb(),
  blocks = [ORDERS],
  lang = "sql",
  meta = "orders",
  sql = ORDERS.sql,
  echo = true,
  display = true,
  provider = true,
}: {
  db?: FakeDuckDb;
  blocks?: SqlBlock[];
  lang?: string;
  meta?: string | null;
  sql?: string;
  echo?: boolean;
  display?: boolean;
  provider?: boolean;
} = {}) {
  const flags = { ...(echo && { echo: "" }), ...(display && { display: "" }) };
  const element = (
    <SqlBlockPre>
      <code
        className={`language-${lang}`}
        {...(meta === null ? {} : { meta })}
        {...flags}
      >
        {sql}
      </code>
    </SqlBlockPre>
  );
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

describe("SqlBlockPre", () => {
  it("renders a named block's rows as a table under the highlighted code", async () => {
    const db = new FakeDuckDb();
    db.rows = [
      { region: "West", orders: 140 },
      { region: "North", orders: 120 },
    ];
    renderFence({ db });

    const table = await screen.findByRole("table");
    expect(
      screen.getAllByRole("columnheader").map((th) => th.textContent),
    ).toEqual(["Region", "Orders"]);
    expect(screen.getByRole("cell", { name: "West" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "140" })).toBeInTheDocument();
    expect(table).toHaveTextContent("North");
    await waitFor(() =>
      expect(document.querySelector("pre.shiki")).not.toBeNull(),
    );
  });

  it("paginates the fence result through the shared table core", async () => {
    const db = new FakeDuckDb();
    db.rows = Array.from({ length: 12 }, (_, i) => ({ n: i + 1 }));
    renderFence({ db });

    expect(await screen.findByText("Page 1 of 2 · 12 rows")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(11);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 2 · 12 rows")).toBeVisible();
  });

  it("sorts the fence result on header click without re-querying", async () => {
    const db = new FakeDuckDb();
    db.rows = [
      { region: "West", orders: 140 },
      { region: "North", orders: 120 },
    ];
    renderFence({ db });

    const header = await screen.findByRole("columnheader", {
      name: "Orders",
    });
    fireEvent.click(screen.getByRole("button", { name: "Orders" }));

    await waitFor(() =>
      expect(header).toHaveAttribute("aria-sort", "descending"),
    );
    expect(db.queries).toHaveLength(1);
  });

  it("shows a 0-rows empty state when the query succeeds with no rows", async () => {
    const db = new FakeDuckDb();
    db.rows = [];
    renderFence({ db });

    expect(await screen.findByText("0 rows")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an inline error naming the block and the failed source", async () => {
    const db = new FakeDuckDb();
    db.failWhen = () => "Catalog Error: Table orders does not exist";
    renderFence({ db });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("orders");
    expect(alert).toHaveTextContent("Table orders does not exist");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a loading skeleton while the query is in flight", async () => {
    const db = new FakeDuckDb();
    db.queryRows = () => Effect.promise(() => new Promise<Row[]>(() => {}));
    renderFence({ db });

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders an unnamed sql fence as code only", async () => {
    const db = renderFence({ meta: null });

    await waitFor(() => expect(db.queries).toHaveLength(1));
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders an echoed named fence as code only outside a query registry", async () => {
    renderFence({ provider: false });

    expect(screen.queryByRole("table")).toBeNull();
    expect(document.querySelector("pre")).toHaveTextContent(
      "select * from orders",
    );
  });

  it("renders code only when the fence name has no registry entry", async () => {
    const db = renderFence({
      meta: "ghost",
      blocks: [{ name: "other", sql: "select 2" }],
    });

    await waitFor(() => expect(db.queries).toHaveLength(1));
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("ignores a meta-carrying fence that is not sql", async () => {
    const db = new FakeDuckDb();
    db.rows = [{ n: 1 }];
    renderFence({ db, lang: "js", meta: "q", sql: "x = 1" });

    expect(document.querySelector("pre")).toHaveTextContent("x = 1");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  describe("display flags", () => {
    it("renders nothing for a named fence with no flags, yet runs its query", async () => {
      const db = new FakeDuckDb();
      db.rows = [{ n: 1 }];
      renderFence({ db, echo: false, display: false });

      await waitFor(() => expect(db.queries).toHaveLength(1));
      expect(document.querySelector("pre")).toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("renders only the code when the fence sets echo", async () => {
      const db = new FakeDuckDb();
      db.rows = [{ n: 1 }];
      renderFence({ db, display: false });

      await waitFor(() => expect(db.queries).toHaveLength(1));
      expect(document.querySelector("pre")).toHaveTextContent(
        "select * from orders",
      );
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("renders only the result table when the fence sets display", async () => {
      const db = new FakeDuckDb();
      db.rows = [{ region: "West" }];
      renderFence({ db, echo: false });

      expect(await screen.findByRole("table")).toHaveTextContent("West");
      expect(document.querySelector("pre")).toBeNull();
    });

    it("renders no skeleton for a hidden fence while its query is in flight", async () => {
      const db = new FakeDuckDb();
      db.holdWhen = () => new Promise<Row[]>(() => {});
      renderFence({ db, echo: false, display: false });

      await waitFor(() => expect(db.queries).toHaveLength(1));
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("still shows the inline error of a hidden fence whose query fails", async () => {
      const db = new FakeDuckDb();
      db.failWhen = () => "Catalog Error: Table orders does not exist";
      renderFence({ db, echo: false, display: false });

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("orders");
      expect(alert).toHaveTextContent("Table orders does not exist");
      expect(document.querySelector("pre")).toBeNull();
    });

    it("renders nothing for a named fence without echo outside a query registry", () => {
      renderFence({ provider: false, echo: false });

      expect(document.querySelector("pre")).toBeNull();
    });
  });
});
