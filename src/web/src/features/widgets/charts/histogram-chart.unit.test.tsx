import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { renderWithRegistry } from "../value/registry-harness";
import { Histogram } from "./histogram-chart";
import {
  AMOUNT_ROWS,
  ORDER_AMOUNTS,
  appliedOption,
  dbWith,
  expectPendingPulse,
  readyHost,
} from "./series-chart.fixture";

interface AppliedOption {
  series: {
    name?: string;
    type?: string;
    stack?: string;
    barCategoryGap?: number;
    data?: unknown[];
  }[];
  xAxis: { type?: string; data?: unknown[] }[];
}

function noChart(): void {
  expect(document.querySelector("[data-echarts-theme]")).toBeNull();
}

describe("<Histogram>", () => {
  it("renders the named query's rows as a stacked gapless histogram", async () => {
    renderWithRegistry(
      <Histogram
        data="order_amounts"
        value="amount"
        series="region"
        renderer="svg"
      />,
      { db: dbWith(AMOUNT_ROWS), blocks: [ORDER_AMOUNTS] },
    );

    // The svg `finished` paint is jsdom's slowest chart path — under a
    // shared suite run the default wait starves, so this test takes a
    // longer leash than the transform assertions need.
    const host = await readyHost(document, 15000);
    await waitFor(() =>
      expect(host).toHaveAttribute(
        "aria-label",
        "histogram chart of amount, split by region",
      ),
    );
    const option = await appliedOption<AppliedOption>(document);
    expect(option.xAxis[0]?.type).toBe("category");
    expect(option.xAxis[0]?.data?.length).toBeGreaterThan(0);
    expect(option.series.every((s) => s.type === "bar")).toBe(true);
    expect(option.series.every((s) => s.stack === "total")).toBe(true);
    expect(option.series.every((s) => s.barCategoryGap === 0)).toBe(true);
    expect(option.series.map((s) => s.name)).toEqual(["North", "South"]);
  });

  it("wraps the fence with the declared filter's bound predicate", async () => {
    const db = new FakeDuckDb();
    db.rowsWhen = (sql) =>
      sql.includes("where region = ?")
        ? AMOUNT_ROWS.filter((row) => row.region === "North")
        : AMOUNT_ROWS;
    renderWithRegistry(
      <Histogram
        data="order_amounts"
        value="amount"
        series="region"
        filters="region"
        renderer="svg"
      />,
      { db, blocks: [ORDER_AMOUNTS], url: "?region=North" },
    );

    const option = await appliedOption<AppliedOption>(document, 15000);
    expect(option.series.map((s) => s.name)).toEqual(["North"]);
    const counts = option.series[0]?.data as number[];
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(12);
    expect(db.queries).toContainEqual({
      sql: "select * from (select amount, region from orders) where region = ?",
      params: ["North"],
    });
  });

  it("alerts when data names no registered fence", async () => {
    renderWithRegistry(<Histogram data="ghost" value="amount" />, {
      db: dbWith(AMOUNT_ROWS),
      blocks: [ORDER_AMOUNTS],
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ghost");
  });

  it("shows the loading pulse at chart height while the query is in flight", async () => {
    await expectPendingPulse(
      <Histogram data="orders" value="amount" height={180} />,
      180,
    );
  });

  it("surfaces a query failure as a named alert", async () => {
    renderWithRegistry(<Histogram data="order_amounts" value="amount" />, {
      db: FakeDuckDb.failing("Catalog Error: Table orders does not exist"),
      blocks: [ORDER_AMOUNTS],
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Table orders does not exist");
    noChart();
  });

  it("shows the empty face when the query returns no rows", async () => {
    renderWithRegistry(<Histogram data="order_amounts" value="amount" />, {
      db: dbWith([]),
      blocks: [ORDER_AMOUNTS],
    });
    expect(await screen.findByText("0 rows")).toBeInTheDocument();
    noChart();
  });

  it("shows the empty face when every value cell is non-numeric", async () => {
    renderWithRegistry(<Histogram data="order_amounts" value="amount" />, {
      db: dbWith([{ amount: "x" }, { amount: null }]),
      blocks: [ORDER_AMOUNTS],
    });
    expect(await screen.findByText("0 rows")).toBeInTheDocument();
    noChart();
  });

  it.each(["value", "series"] as const)(
    "alerts when %s names a column the result lacks",
    async (prop) => {
      renderWithRegistry(
        <Histogram
          data="order_amounts"
          value="amount"
          {...{ [prop]: "nope" }}
        />,
        { db: dbWith(AMOUNT_ROWS), blocks: [ORDER_AMOUNTS] },
      );
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent('"nope"');
      expect(alert).toHaveTextContent("amount");
    },
  );

  it("alerts on an unknown fmt code", async () => {
    renderWithRegistry(
      <Histogram data="order_amounts" value="amount" valueFmt="bogus" />,
      { db: dbWith(AMOUNT_ROWS), blocks: [ORDER_AMOUNTS] },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent('fmt="bogus"');
  });
});
