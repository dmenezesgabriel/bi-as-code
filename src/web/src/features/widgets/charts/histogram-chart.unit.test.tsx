import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { renderWithRegistry } from "../value/registry-harness";
import { Table } from "../table/table";
import { Histogram } from "./histogram-chart";
import { histogramQuery } from "./histogram-sql";
import {
  AMOUNT_ROWS,
  OPTS,
  ORDER_AMOUNTS,
  appliedOption,
  dbSelectable,
  dbWith,
  expectPendingPulse,
  legendToggle,
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
  xAxis: { type?: string; min?: number; max?: number }[];
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
    expect(option.xAxis[0]?.type).toBe("value");
    expect(option.series.every((s) => s.type === "bar")).toBe(true);
    expect(option.series.every((s) => s.stack === "total")).toBe(true);
    expect(option.series.every((s) => s.barCategoryGap === 0)).toBe(true);
    expect(option.series.map((s) => s.name)).toEqual(["North", "South"]);
  });

  it("re-queries bin counts over the fence's full extent under a filter", async () => {
    const db = new FakeDuckDb();
    // One bin row per non-empty (bin, series) pair — never the raw rows.
    db.rowsWhen = (sql) =>
      sql.startsWith("with base as")
        ? [
            {
              lo: 0,
              bin_width: 10,
              bin_count: 3,
              bin_index: 1,
              series: "North",
              first_seen: 1n,
              frequency: 12n,
            },
          ]
        : AMOUNT_ROWS;
    const spec = { value: "amount", series: "region" };
    renderWithRegistry(
      <Histogram
        data="order_amounts"
        {...spec}
        filters="region"
        renderer="svg"
      />,
      { db, blocks: [ORDER_AMOUNTS], url: "?region=North" },
    );

    const option = await appliedOption<AppliedOption>(document, 15000);

    expect(option.series.map((s) => s.name)).toEqual(["North"]);
    expect(option.series[0]?.data).toEqual([
      [5, 0],
      [15, 12],
      [25, 0],
    ]);
    expect(option.xAxis[0]).toMatchObject({ min: 0, max: 30 });
    const block = {
      sql: "select amount, region from orders",
      params: [],
      errors: [],
    };
    expect(db.queries).toContainEqual({
      sql: histogramQuery(block, { sql: "region = ?", params: [] }, spec).sql,
      params: ["North"],
    });
  });

  it("publishes the enabled set on a legend toggle under crossfilter", async () => {
    renderWithRegistry(
      <>
        <Histogram
          data="order_amounts"
          value="amount"
          series="region"
          filters="region"
          select="crossfilter"
          renderer="svg"
        />
        <Table data="opts" filters="region" />
      </>,
      {
        db: dbSelectable("region", AMOUNT_ROWS),
        blocks: [ORDER_AMOUNTS, OPTS],
        port: new FakeFilterUrlPort(""),
      },
    );

    const host = await readyHost(document, 15000);
    const bodyRows = () => document.querySelectorAll("tbody tr").length;
    await waitFor(() => expect(bodyRows()).toBe(3));

    act(() => legendToggle(host, "North"));

    // `region IN ('South')` narrows the consumer; the histogram's own
    // clause skips it — both region series and the disabled entry hold.
    await waitFor(() => expect(bodyRows()).toBe(1));
    const option = await appliedOption<{
      series: { name?: string }[];
      legend: { selected?: Record<string, boolean> }[];
    }>(document);
    expect(option.series.map((s) => s.name)).toEqual(["North", "South"]);
    expect(option.legend[0]?.selected?.North).toBe(false);
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
