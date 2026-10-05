import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { SqlBlock } from "../../pages/types";
import { renderWithRegistry } from "./registry-harness";
import type { ValueProps } from "./types";
import { Value } from "./value";

const KPI: SqlBlock = {
  name: "kpi",
  sql: "select revenue, wow_pct from orders",
};

function renderValue(
  props: Partial<ValueProps> = {},
  { db = new FakeDuckDb(), blocks = [KPI], provider = true } = {},
) {
  return renderWithRegistry(<Value data="kpi" {...props} />, {
    db,
    blocks,
    provider,
  });
}

describe("Value", () => {
  it("renders the row's first column when column is unset", async () => {
    renderValue(
      {},
      { db: FakeDuckDb.withRows([{ revenue: 1500, orders: 3 }]) },
    );

    expect(await screen.findByText("1,500")).toBeInTheDocument();
  });

  it("formats the named column with fmt", async () => {
    renderValue(
      { column: "revenue", fmt: "usd" },
      { db: FakeDuckDb.withRows([{ revenue: 1234567, orders: 3 }]) },
    );

    expect(await screen.findByText("$1.2M")).toBeInTheDocument();
  });

  it("reads the cell at the row index when row is set", async () => {
    renderValue(
      { column: "revenue", row: 2 },
      {
        db: FakeDuckDb.withRows([
          { revenue: 100 },
          { revenue: 200 },
          { revenue: 300 },
        ]),
      },
    );

    expect(await screen.findByText("300")).toBeInTheDocument();
  });

  it("renders an inline alert naming a data value no sql block declares", async () => {
    renderValue({ data: "ghost" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ghost");
  });

  it("renders the same unknown-name alert outside a query registry", async () => {
    renderValue({}, { provider: false });

    expect(await screen.findByRole("alert")).toHaveTextContent("kpi");
  });

  it("renders an inline alert with the query's message when it fails", async () => {
    renderValue(
      {},
      { db: FakeDuckDb.failing("Catalog Error: Table orders does not exist") },
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("kpi");
    expect(alert).toHaveTextContent("Table orders does not exist");
  });

  it("pulses a placeholder while the query is in flight", async () => {
    renderValue({}, { db: FakeDuckDb.pending() });

    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("renders an en dash when the query returns no rows", async () => {
    renderValue({}, { db: FakeDuckDb.withRows([]) });

    expect(await screen.findByText("–")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders an en dash when row points past the result", async () => {
    renderValue({ row: 5 }, { db: FakeDuckDb.withRows([{ revenue: 100 }]) });

    expect(await screen.findByText("–")).toBeInTheDocument();
  });

  it("alerts naming an unknown column and the available ones", async () => {
    renderValue(
      { column: "sales" },
      { db: FakeDuckDb.withRows([{ revenue: 100, orders: 3 }]) },
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('"sales"');
    expect(alert).toHaveTextContent("revenue, orders");
  });

  it("alerts naming an unknown fmt code", async () => {
    renderValue(
      { fmt: "bogus" },
      { db: FakeDuckDb.withRows([{ revenue: 100 }]) },
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('fmt="bogus"');
  });

  it("renders a negative value in red when redNegatives is set", async () => {
    renderValue(
      { redNegatives: true },
      { db: FakeDuckDb.withRows([{ delta: -42 }]) },
    );

    const el = await screen.findByText("-42.0");
    expect(el.className).toContain("text-red-");
  });

  it("leaves positive values uncolored under redNegatives", async () => {
    renderValue(
      { redNegatives: true },
      { db: FakeDuckDb.withRows([{ delta: 42 }]) },
    );

    const el = await screen.findByText("42.0");
    expect(el.className).not.toContain("text-red-");
  });

  it("applies the color prop as an inline style", async () => {
    renderValue(
      { color: "tomato" },
      { db: FakeDuckDb.withRows([{ revenue: 100 }]) },
    );

    const el = await screen.findByText("100");
    expect(el.style.color).toBe("tomato");
  });

  it("lets redNegatives win over color on a negative value", async () => {
    renderValue(
      { redNegatives: true, color: "tomato" },
      { db: FakeDuckDb.withRows([{ delta: -42 }]) },
    );

    const el = await screen.findByText("-42.0");
    expect(el.className).toContain("text-red-");
    expect(el.style.color).toBe("");
  });
});
