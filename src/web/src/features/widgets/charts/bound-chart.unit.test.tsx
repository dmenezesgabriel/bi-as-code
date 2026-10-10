import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { renderWithRegistry } from "../value/registry-harness";
import type { EChartHostElement } from "./types";
import { BarChart } from "./bar-chart";
import { Histogram } from "./histogram-chart";
import {
  AMOUNT_ROWS,
  OPTS,
  OPTS_ROWS,
  ORDER_AMOUNTS,
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
