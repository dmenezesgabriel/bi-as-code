import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { renderWithRegistry } from "../value/registry-harness";
import { AreaChart } from "./area-chart";
import { BarChart } from "./bar-chart";
import { LineChart } from "./line-chart";
import { SeriesChart } from "./series-chart";
import {
  ORDERS_REGIONAL,
  REGIONAL_ROWS,
  TREND_ROWS,
  WEEKLY_TREND,
  dbWith,
} from "./series-chart.fixture";
import type { EChartHostElement } from "./types";

/** The option shape a test reads back off the live echarts instance. */
interface AppliedOption {
  series: {
    name?: string;
    type?: string;
    stack?: string;
    areaStyle?: unknown;
    label?: { show?: boolean };
    data?: unknown[];
  }[];
  yAxis: { max?: number }[];
  legend: unknown[];
}

/**
 * The mounted host, awaited on the first finished render's ready mark.
 * `finished` fires after echarts' entry animation completes — ~1.5s for a
 * full option under jsdom — so this waits well past the 1s default.
 */
async function chartHost(): Promise<EChartHostElement> {
  const host = await waitFor(
    () => {
      const el = document.querySelector<EChartHostElement>(
        "[data-echarts-theme]",
      );
      expect(el).toHaveAttribute("data-echarts-ready");
      return el;
    },
    { timeout: 4000 },
  );
  if (!host) throw new Error("chart host not rendered");
  return host;
}

function appliedOption(host: EChartHostElement): AppliedOption {
  const chart = host.echartsInstance;
  if (!chart) throw new Error("echartsInstance not exposed on host");
  return chart.getOption() as unknown as AppliedOption;
}

function noChart(): void {
  expect(document.querySelector("[data-echarts-theme]")).toBeNull();
}

describe("series chart tags", () => {
  it("renders the named query's rows as a chart, bound by data", async () => {
    renderWithRegistry(
      <BarChart data="orders" x="region" y="revenue" renderer="svg" />,
      { db: dbWith(REGIONAL_ROWS), blocks: [ORDERS_REGIONAL] },
    );

    const host = await chartHost();
    expect(host).toHaveStyle({ height: "300px" });
    expect(host).toHaveAttribute("data-echarts-theme", "light");
    await waitFor(() =>
      expect(host).toHaveAttribute(
        "aria-label",
        "bar chart of revenue by region",
      ),
    );
    expect(appliedOption(host).series[0]?.data).toHaveLength(3);
  });

  it("fixes the echarts type per tag", async () => {
    renderWithRegistry(
      <>
        <BarChart data="orders" x="region" y="revenue" renderer="svg" />
        <LineChart data="orders" x="region" y="revenue" renderer="svg" />
        <AreaChart data="orders" x="region" y="revenue" renderer="svg" />
      </>,
      { db: dbWith(REGIONAL_ROWS), blocks: [ORDERS_REGIONAL] },
    );

    await waitFor(
      () =>
        expect(document.querySelectorAll("[data-echarts-ready]")).toHaveLength(
          3,
        ),
      { timeout: 4000 },
    );
    const [bar, line, area] = [
      ...document.querySelectorAll<EChartHostElement>("[data-echarts-theme]"),
    ];
    expect(appliedOption(bar!).series[0]?.type).toBe("bar");
    expect(appliedOption(line!).series[0]?.type).toBe("line");
    const areaSeries = appliedOption(area!).series[0];
    expect(areaSeries?.type).toBe("line");
    expect(areaSeries?.areaStyle).toBeDefined();
  });

  it("groups rows into one named series per series-column value", async () => {
    renderWithRegistry(
      <LineChart
        data="weekly_trend"
        x="week"
        y="orders"
        series="region"
        renderer="svg"
      />,
      { db: dbWith(TREND_ROWS), blocks: [WEEKLY_TREND] },
    );

    const option = appliedOption(await chartHost());
    expect(option.series.map((s) => s.name)).toEqual(["North", "South"]);
    expect(option.legend.length).toBeGreaterThan(0);
  });

  it("emits one series per column when y is an array", async () => {
    renderWithRegistry(
      <BarChart
        data="orders"
        x="region"
        y={["revenue", "orders"]}
        renderer="svg"
      />,
      { db: dbWith(REGIONAL_ROWS), blocks: [ORDERS_REGIONAL] },
    );

    const option = appliedOption(await chartHost());
    expect(option.series.map((s) => s.name)).toEqual(["revenue", "orders"]);
  });

  it("stacks every series on one stack when stacked is set", async () => {
    renderWithRegistry(
      <LineChart
        data="weekly_trend"
        x="week"
        y="orders"
        series="region"
        stacked
        renderer="svg"
      />,
      { db: dbWith(TREND_ROWS), blocks: [WEEKLY_TREND] },
    );

    const option = appliedOption(await chartHost());
    expect(option.series.length).toBeGreaterThan(1);
    expect(option.series.every((s) => s.stack === "total")).toBe(true);
  });

  it('pins a 0–1 y axis when stacked="100%"', async () => {
    renderWithRegistry(
      <AreaChart
        data="weekly_trend"
        x="week"
        y="orders"
        series="region"
        stacked="100%"
        renderer="svg"
      />,
      { db: dbWith(TREND_ROWS), blocks: [WEEKLY_TREND] },
    );

    const option = appliedOption(await chartHost());
    expect(option.series.every((s) => s.stack === "total")).toBe(true);
    expect(option.yAxis[0]?.max).toBe(1);
  });

  it("draws point labels when labels is set", async () => {
    renderWithRegistry(
      <BarChart data="orders" x="region" y="revenue" labels renderer="svg" />,
      { db: dbWith(REGIONAL_ROWS), blocks: [ORDERS_REGIONAL] },
    );

    const option = appliedOption(await chartHost());
    expect(option.series[0]?.label?.show).toBe(true);
  });

  it("sizes the chart host to the height prop", async () => {
    renderWithRegistry(
      <BarChart
        data="orders"
        x="region"
        y="revenue"
        height={180}
        renderer="svg"
      />,
      { db: dbWith(REGIONAL_ROWS), blocks: [ORDERS_REGIONAL] },
    );

    expect(await chartHost()).toHaveStyle({ height: "180px" });
  });
});

describe("series chart states", () => {
  it("alerts when data names no registered fence", async () => {
    renderWithRegistry(<BarChart data="ghost" x="region" y="revenue" />, {
      db: dbWith(REGIONAL_ROWS),
      blocks: [ORDERS_REGIONAL],
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ghost");
    expect(alert).toHaveTextContent("no sql fence");
  });

  it("shows the same unknown-name alert outside a query registry", async () => {
    renderWithRegistry(<BarChart data="orders" x="region" y="revenue" />, {
      blocks: [ORDERS_REGIONAL],
      provider: false,
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("orders");
  });

  it("shows the loading pulse at chart height while the query is in flight", async () => {
    renderWithRegistry(
      <BarChart data="orders" x="region" y="revenue" height={180} />,
      { db: FakeDuckDb.pending(), blocks: [ORDERS_REGIONAL] },
    );

    const status = await screen.findByRole("status");
    expect(status).toHaveStyle({ height: "180px" });
    noChart();
  });

  it("surfaces a query failure as a named alert", async () => {
    renderWithRegistry(<BarChart data="orders" x="region" y="revenue" />, {
      db: FakeDuckDb.failing("Catalog Error: Table orders does not exist"),
      blocks: [ORDERS_REGIONAL],
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("orders");
    expect(alert).toHaveTextContent("Table orders does not exist");
    noChart();
  });

  it("shows the empty face when the query returns no rows", async () => {
    renderWithRegistry(<BarChart data="orders" x="region" y="revenue" />, {
      db: dbWith([]),
      blocks: [ORDERS_REGIONAL],
    });

    expect(await screen.findByText("0 rows")).toBeInTheDocument();
    noChart();
  });

  it("keeps the empty face when a typo'd column has no rows to validate against", async () => {
    renderWithRegistry(<BarChart data="orders" x="typo" y="revenue" />, {
      db: dbWith([]),
      blocks: [ORDERS_REGIONAL],
    });

    expect(await screen.findByText("0 rows")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("alerts with the available columns when x names a column the result lacks", async () => {
    renderWithRegistry(<BarChart data="orders" x="typo" y="revenue" />, {
      db: dbWith(REGIONAL_ROWS),
      blocks: [ORDERS_REGIONAL],
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('"typo"');
    expect(alert).toHaveTextContent("region");
  });

  it("alerts when y names a column the result lacks", async () => {
    renderWithRegistry(<BarChart data="orders" x="region" y="revenu" />, {
      db: dbWith(REGIONAL_ROWS),
      blocks: [ORDERS_REGIONAL],
    });

    expect(await screen.findByRole("alert")).toHaveTextContent('"revenu"');
  });

  it("alerts when series names a column the result lacks", async () => {
    renderWithRegistry(
      <LineChart
        data="weekly_trend"
        x="week"
        y="orders"
        series="regeon"
        renderer="svg"
      />,
      { db: dbWith(TREND_ROWS), blocks: [WEEKLY_TREND] },
    );

    expect(await screen.findByRole("alert")).toHaveTextContent('"regeon"');
  });

  it("alerts on an unknown fmt code", async () => {
    renderWithRegistry(
      <BarChart data="orders" x="region" y="revenue" yFmt="bogus" />,
      { db: dbWith(REGIONAL_ROWS), blocks: [ORDERS_REGIONAL] },
    );

    expect(await screen.findByRole("alert")).toHaveTextContent('fmt="bogus"');
  });
});

describe("<SeriesChart>", () => {
  it("renders the shared body directly with an explicit type", async () => {
    renderWithRegistry(
      <SeriesChart
        type="line"
        data="weekly_trend"
        x="week"
        y="orders"
        renderer="svg"
      />,
      { db: dbWith(TREND_ROWS), blocks: [WEEKLY_TREND] },
    );

    const option = appliedOption(await chartHost());
    expect(option.series[0]?.type).toBe("line");
    expect(option.series[0]?.name).toBe("orders");
  });
});
