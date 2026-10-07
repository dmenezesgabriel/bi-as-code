import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import type { SqlBlock } from "../../pages/types";
import { renderWithRegistry } from "./registry-harness";
import { Sparkline } from "./sparkline-widget";
import type { SparklineProps } from "./types";

const TREND: SqlBlock = {
  name: "weekly_revenue",
  sql: "select week, revenue from orders",
};

const WEEKS: Row[] = [
  { week: 1, revenue: 980 },
  { week: 2, revenue: 1024 },
  { week: 3, revenue: 1108 },
  { week: 4, revenue: 1051 },
  { week: 5, revenue: 1180 },
];

function renderSparkline(
  props: Partial<SparklineProps> = {},
  {
    db = new FakeDuckDb(),
    blocks = [TREND],
    provider = true,
    url,
  }: {
    db?: FakeDuckDb;
    blocks?: SqlBlock[];
    provider?: boolean;
    url?: string;
  } = {},
) {
  return renderWithRegistry(<Sparkline data="weekly_revenue" {...props} />, {
    db,
    blocks,
    provider,
    url,
  });
}

describe("Sparkline", () => {
  it("wraps the fence with the declared filter's bound predicate", async () => {
    const db = new FakeDuckDb();
    db.rowsWhen = (sql) =>
      sql.includes("where region = ?") ? WEEKS.slice(0, 2) : WEEKS;
    renderSparkline({ filters: "region" }, { db, url: "?region=West" });

    const svg = await screen.findByRole("img");
    const d = svg.querySelector("path")!.getAttribute("d")!;
    expect(d.split("L")).toHaveLength(2);
    expect(db.queries).toContainEqual({
      sql: "select * from (select week, revenue from orders) where region = ?",
      params: ["West"],
    });
  });

  it("projects the named query's rows into a line sparkline", async () => {
    renderSparkline({}, { db: FakeDuckDb.withRows(WEEKS) });

    const svg = await screen.findByRole("img");
    const d = svg.querySelector("path")!.getAttribute("d")!;
    expect(d.split("L")).toHaveLength(WEEKS.length);
  });

  it("names the data source as the default aria-label", async () => {
    renderSparkline({}, { db: FakeDuckDb.withRows(WEEKS) });

    const svg = await screen.findByRole("img");
    expect(svg).toHaveAttribute("aria-label", "weekly_revenue");
  });

  it("names both columns in the label when x and y are authored", async () => {
    renderSparkline(
      { x: "week", y: "revenue" },
      { db: FakeDuckDb.withRows(WEEKS) },
    );

    const svg = await screen.findByRole("img");
    expect(svg).toHaveAttribute("aria-label", "revenue by week");
  });

  it("honors the label prop", async () => {
    renderSparkline(
      { label: "Revenue trend" },
      { db: FakeDuckDb.withRows(WEEKS) },
    );

    const svg = await screen.findByRole("img");
    expect(svg).toHaveAttribute("aria-label", "Revenue trend");
  });

  it("draws bars when type is bar", async () => {
    renderSparkline({ type: "bar" }, { db: FakeDuckDb.withRows(WEEKS) });

    const svg = await screen.findByRole("img");
    expect(svg.querySelectorAll("rect")).toHaveLength(WEEKS.length);
  });

  it("projects named x/y columns", async () => {
    renderSparkline(
      { x: "t", y: "orders" },
      {
        db: FakeDuckDb.withRows([
          { t: "a", orders: 3, revenue: 10 },
          { t: "b", orders: 5, revenue: 20 },
        ]),
      },
    );

    const svg = await screen.findByRole("img");
    expect(svg.querySelector("path")).not.toBeNull();
    expect(svg).toHaveAttribute("aria-label", "orders by t");
  });

  it("applies the color prop", async () => {
    renderSparkline({ color: "#059669" }, { db: FakeDuckDb.withRows(WEEKS) });

    const svg = await screen.findByRole("img");
    const span = svg.parentElement as HTMLElement;
    expect(span.style.color).toBe("rgb(5, 150, 105)");
  });

  it("renders an inline alert naming a data value no sql block declares", async () => {
    renderSparkline({ data: "ghost" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ghost");
  });

  it("renders the same unknown-name alert outside a query registry", async () => {
    renderSparkline({}, { provider: false });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "weekly_revenue",
    );
  });

  it("renders an inline alert with the query's message when it fails", async () => {
    renderSparkline(
      {},
      { db: FakeDuckDb.failing("Catalog Error: Table orders does not exist") },
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("weekly_revenue");
    expect(alert).toHaveTextContent("Table orders does not exist");
  });

  it("pulses a placeholder while the query is in flight", async () => {
    renderSparkline({}, { db: FakeDuckDb.pending() });

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders an en dash when the query returns no rows", async () => {
    renderSparkline({}, { db: FakeDuckDb.withRows([]) });

    expect(await screen.findByText("–")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("alerts naming an unknown y column and the available ones", async () => {
    renderSparkline({ y: "sales" }, { db: FakeDuckDb.withRows(WEEKS) });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('"sales"');
    expect(alert).toHaveTextContent("week, revenue");
  });
});
