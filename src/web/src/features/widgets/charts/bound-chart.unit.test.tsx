import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Row } from "../../data/types";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { renderWithRegistry } from "../value/registry-harness";
import type { EChartHostElement } from "./types";
import { BarChart } from "./bar-chart";
import { Histogram } from "./histogram-chart";
import {
  AMOUNT_ROWS,
  OPTS,
  OPTS_ROWS,
  ORDERS_REGIONAL,
  ORDER_AMOUNTS,
  REGIONAL_ROWS,
  dbSelectable,
  legendToggle,
} from "./series-chart.fixture";

/** The publisher histogram, then the `filters="region"` consumer bar chart. */
function renderPublisherAndConsumer(): ReturnType<typeof dbSelectable> {
  const db = dbSelectable("region", AMOUNT_ROWS);
  renderWithRegistry(
    <>
      <Histogram
        data="order_amounts"
        value="amount"
        series="region"
        select="crossfilter"
        renderer="svg"
      />
      <BarChart
        data="opts"
        x="region"
        y="amount"
        filters="region"
        renderer="svg"
      />
    </>,
    { db, blocks: [ORDER_AMOUNTS, OPTS], port: new FakeFilterUrlPort("") },
  );
  return db;
}

/** Both chart hosts once each has finished its first paint. */
async function readyHosts(): Promise<[EChartHostElement, EChartHostElement]> {
  return waitFor(
    () => {
      const hosts = document.querySelectorAll<EChartHostElement>(
        "[data-echarts-theme]",
      );
      expect(hosts).toHaveLength(2);
      hosts.forEach((host) =>
        expect(host).toHaveAttribute("data-echarts-ready"),
      );
      return [hosts[0], hosts[1]] as [EChartHostElement, EChartHostElement];
    },
    { timeout: 15000 },
  );
}

/** A promise the test resolves by hand — the held re-query's result. */
function deferredRows(): {
  promise: Promise<Row[]>;
  resolve: (rows: Row[]) => void;
} {
  let resolve: (rows: Row[]) => void = () => {};
  const promise = new Promise<Row[]>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function consumerCategories(host: EChartHostElement): unknown[] | undefined {
  const option = host.echartsInstance?.getOption() as
    | { xAxis?: { data?: unknown[] }[] }
    | undefined;
  return option?.xAxis?.[0]?.data;
}

describe("<BoundChart> while a cross-filter re-query is pending", () => {
  it("keeps the painted chart, marked busy, instead of the loading face", async () => {
    const db = renderPublisherAndConsumer();
    const held = deferredRows();
    db.holdWhen = (sql) => (sql.includes("region IN (") ? held.promise : null);
    const [publisher, consumer] = await readyHosts();
    const instance = consumer.echartsInstance;

    act(() => legendToggle(publisher, "North"));

    await waitFor(() =>
      expect(consumer.parentElement).toHaveAttribute("aria-busy", "true"),
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(consumer.isConnected).toBe(true);
    expect(consumer.echartsInstance).toBe(instance);
    expect(consumerCategories(consumer)).toEqual(["West", "North", "South"]);
  });

  it("repaints the same instance with the settled rows and clears busy", async () => {
    const db = renderPublisherAndConsumer();
    const held = deferredRows();
    db.holdWhen = (sql) => (sql.includes("region IN (") ? held.promise : null);
    const [publisher, consumer] = await readyHosts();
    const instance = consumer.echartsInstance;
    act(() => legendToggle(publisher, "North"));
    await waitFor(() =>
      expect(consumer.parentElement).toHaveAttribute("aria-busy", "true"),
    );

    await act(async () => held.resolve(OPTS_ROWS.slice(2)));

    await waitFor(() =>
      expect(consumerCategories(consumer)).toEqual(["South"]),
    );
    expect(consumer.parentElement).not.toHaveAttribute("aria-busy");
    expect(consumer.echartsInstance).toBe(instance);
  });

  it("swaps the kept chart for the alert when the re-query fails", async () => {
    const db = renderPublisherAndConsumer();
    db.failWhen = (sql) => (sql.includes("region IN (") ? "boom" : null);
    const [publisher] = await readyHosts();

    act(() => legendToggle(publisher, "North"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/^opts: .*boom/);
    expect(document.querySelectorAll("[data-echarts-theme]")).toHaveLength(1);
  });
});

/** The first paint's budget — echarts' svg renderer under jsdom is slow. */
const PAINTED = { timeout: 15000 };

/** A titled bar chart over the `orders` fence, answered by `db`. */
function renderTitled(db: FakeDuckDb, data = "orders"): void {
  renderWithRegistry(
    <BarChart
      data={data}
      x="region"
      y="revenue"
      title="Revenue by region"
      subtitle="US dollars"
      renderer="svg"
    />,
    { db, blocks: [ORDERS_REGIONAL] },
  );
}

describe("<BoundChart> title and subtitle", () => {
  it("names the chart's figure with the title, both lines above the plot", async () => {
    renderTitled(FakeDuckDb.withRows(REGIONAL_ROWS));

    const figure = screen.getByRole("figure", { name: "Revenue by region" });
    const host = await waitFor(() => {
      const found = figure.querySelector("[data-echarts-ready]");
      expect(found).not.toBeNull();
      return found as Element;
    }, PAINTED);
    const subtitle = screen.getByText("US dollars");
    expect(figure).toContainElement(subtitle);
    expect(subtitle.compareDocumentPosition(host)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("keeps the title over the loading face", () => {
    renderTitled(FakeDuckDb.pending());

    const figure = screen.getByRole("figure", { name: "Revenue by region" });
    expect(figure).toContainElement(screen.getByRole("status"));
  });

  it("keeps the title over the error face", async () => {
    renderTitled(FakeDuckDb.failing("boom"));

    const figure = screen.getByRole("figure", { name: "Revenue by region" });
    expect(figure).toContainElement(await screen.findByRole("alert"));
  });

  it("keeps the title over an unknown data name", () => {
    renderTitled(new FakeDuckDb(), "missing");

    const figure = screen.getByRole("figure", { name: "Revenue by region" });
    expect(figure).toContainElement(screen.getByRole("alert"));
  });

  it("keeps the title over the empty face", async () => {
    renderTitled(FakeDuckDb.withRows([]));

    const figure = screen.getByRole("figure", { name: "Revenue by region" });
    expect(figure).toContainElement(await screen.findByText("0 rows"));
  });

  it("keeps the title outside the busy region, so a re-query never dims it", async () => {
    renderTitled(FakeDuckDb.withRows(REGIONAL_ROWS));

    const busyRegion = await waitFor(() => {
      const host = document.querySelector("[data-echarts-ready]");
      expect(host).not.toBeNull();
      return host?.parentElement;
    }, PAINTED);
    expect(busyRegion).not.toContainElement(
      screen.getByText("Revenue by region"),
    );
  });

  it("renders no figure for an untitled chart", async () => {
    renderWithRegistry(
      <BarChart data="orders" x="region" y="revenue" renderer="svg" />,
      { db: FakeDuckDb.withRows(REGIONAL_ROWS), blocks: [ORDERS_REGIONAL] },
    );

    await waitFor(
      () =>
        expect(document.querySelector("[data-echarts-ready]")).not.toBeNull(),
      PAINTED,
    );
    expect(screen.queryByRole("figure")).toBeNull();
  });
});
