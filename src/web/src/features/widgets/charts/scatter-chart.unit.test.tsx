import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { renderWithRegistry } from "../value/registry-harness";
import { ScatterChart } from "./scatter-chart";
import {
  ORDERS_REGIONAL,
  SCATTER_ROWS,
  appliedOption,
  dbWith,
  expectEmptyFace,
  expectPendingPulse,
  readyHost,
} from "./series-chart.fixture";

interface AppliedOption {
  series: {
    name?: string;
    type?: string;
    symbolSize?: unknown;
    data?: unknown[];
  }[];
  legend: unknown[];
}

function noChart(): void {
  expect(document.querySelector("[data-echarts-theme]")).toBeNull();
}

describe("<ScatterChart>", () => {
  it("renders the named query's rows as a scatter chart", async () => {
    renderWithRegistry(
      <ScatterChart
        data="orders"
        x="orders"
        y="revenue"
        series="region"
        size="accounts"
        renderer="svg"
      />,
      { db: dbWith(SCATTER_ROWS), blocks: [ORDERS_REGIONAL] },
    );

    const host = await readyHost(document, 4000);
    await waitFor(() =>
      expect(host).toHaveAttribute(
        "aria-label",
        "scatter chart of revenue by orders, split by region",
      ),
    );
    const option = await appliedOption<AppliedOption>(document);
    expect(option.series.map((s) => s.type)).toEqual(["scatter", "scatter"]);
    expect(option.series.map((s) => s.name)).toEqual(["North", "South"]);
    expect(option.series[0]?.data).toEqual([
      [120, 4800, 14],
      [140, 5300, 18],
    ]);
    expect(typeof option.series[0]?.symbolSize).toBe("function");
    expect(option.legend.length).toBeGreaterThan(0);
  });

  it("wraps the fence with the declared filter's bound predicate", async () => {
    const db = new FakeDuckDb();
    db.rowsWhen = (sql) =>
      sql.includes("where region = ?")
        ? SCATTER_ROWS.filter((row) => row.region === "North")
        : SCATTER_ROWS;
    renderWithRegistry(
      <ScatterChart
        data="orders"
        x="orders"
        y="revenue"
        series="region"
        filters="region"
        renderer="svg"
      />,
      { db, blocks: [ORDERS_REGIONAL], url: "?region=North" },
    );

    const option = await appliedOption<AppliedOption>(document, 4000);
    expect(option.series.map((s) => s.name)).toEqual(["North"]);
    expect(option.series[0]?.data).toHaveLength(2);
    expect(db.queries).toContainEqual({
      sql: "select * from (select region, revenue, orders from orders) where region = ?",
      params: ["North"],
    });
  });

  it("alerts when data names no registered fence", async () => {
    renderWithRegistry(<ScatterChart data="ghost" x="orders" y="revenue" />, {
      db: dbWith(SCATTER_ROWS),
      blocks: [ORDERS_REGIONAL],
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ghost");
  });

  it("shows the loading pulse at chart height while the query is in flight", async () => {
    await expectPendingPulse(
      <ScatterChart data="orders" x="orders" y="revenue" height={180} />,
      180,
    );
  });

  it("surfaces a query failure as a named alert", async () => {
    renderWithRegistry(<ScatterChart data="orders" x="orders" y="revenue" />, {
      db: FakeDuckDb.failing("Catalog Error: Table orders does not exist"),
      blocks: [ORDERS_REGIONAL],
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Table orders does not exist");
    noChart();
  });

  it("shows the empty face when the query returns no rows", async () => {
    await expectEmptyFace(
      <ScatterChart data="orders" x="orders" y="revenue" />,
    );
  });

  it.each(["x", "y", "series", "size"] as const)(
    "alerts when %s names a column the result lacks",
    async (prop) => {
      renderWithRegistry(
        <ScatterChart
          data="orders"
          x="orders"
          y="revenue"
          {...{ [prop]: "nope" }}
        />,
        { db: dbWith(SCATTER_ROWS), blocks: [ORDERS_REGIONAL] },
      );
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent('"nope"');
      expect(alert).toHaveTextContent("region");
    },
  );

  it("alerts on an unknown fmt code", async () => {
    renderWithRegistry(
      <ScatterChart data="orders" x="orders" y="revenue" yFmt="bogus" />,
      { db: dbWith(SCATTER_ROWS), blocks: [ORDERS_REGIONAL] },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent('fmt="bogus"');
  });
});
