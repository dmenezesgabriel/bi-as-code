import { cleanup, screen, waitFor } from "@testing-library/react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { renderWithRegistry } from "../value/registry-harness";
import { Heatmap } from "./heatmap-chart";
import {
  TREND_ROWS,
  WEEKLY_TREND,
  appliedOption,
  dbWith,
  expectPendingPulse,
  readyHost,
} from "./series-chart.fixture";
import type { HeatmapChartProps } from "./types";

interface AppliedOption {
  series: { type?: string; data?: unknown[] }[];
  xAxis: { type?: string; position?: string; data?: unknown[] }[];
  yAxis: { type?: string; inverse?: boolean; data?: unknown[] }[];
  visualMap: { min?: number; max?: number; show?: boolean }[];
}

function noChart(): void {
  expect(document.querySelector("[data-echarts-theme]")).toBeNull();
}

describe("<Heatmap>", () => {
  it("renders the named query's rows as a heatmap grid", async () => {
    renderWithRegistry(
      <Heatmap
        data="weekly_trend"
        x="week"
        y="region"
        value="orders"
        renderer="svg"
      />,
      { db: dbWith(TREND_ROWS), blocks: [WEEKLY_TREND] },
    );

    // The svg `finished` paint is jsdom's slowest chart path — under a
    // shared suite run the default wait starves, so this test takes a
    // longer leash than the transform assertions need.
    const host = await readyHost(document, 15000);
    await waitFor(() =>
      expect(host).toHaveAttribute(
        "aria-label",
        "heatmap chart of orders by week and region",
      ),
    );
    const option = await appliedOption<AppliedOption>(document);
    expect(option.series[0]?.type).toBe("heatmap");
    expect(option.series[0]?.data).toEqual([
      [0, 0, 120],
      [1, 0, 130],
      [2, 0, 140],
      [0, 1, 90],
      [1, 1, 95],
      [2, 1, 100],
    ]);
    expect(option.xAxis[0]?.type).toBe("category");
    expect(option.xAxis[0]?.position).toBe("top");
    expect(option.yAxis[0]?.inverse).toBe(true);
    expect(option.visualMap[0]?.min).toBe(90);
    expect(option.visualMap[0]?.max).toBe(140);
  });

  it("wraps the fence with the declared filter's bound predicate", async () => {
    const db = new FakeDuckDb();
    db.rowsWhen = (sql) =>
      sql.includes("where region = ?")
        ? TREND_ROWS.filter((row) => row.region === "South")
        : TREND_ROWS;
    renderWithRegistry(
      <Heatmap
        data="weekly_trend"
        x="week"
        y="region"
        value="orders"
        filters="region"
        renderer="svg"
      />,
      { db, blocks: [WEEKLY_TREND], url: "?region=South" },
    );

    const option = await appliedOption<AppliedOption>(document, 15000);
    expect(option.series[0]?.data).toEqual([
      [0, 0, 90],
      [1, 0, 95],
      [2, 0, 100],
    ]);
    expect(db.queries).toContainEqual({
      sql: "select * from (select week, region, orders from trend) where region = ?",
      params: ["South"],
    });
  });

  it("alerts when data names no registered fence", async () => {
    renderWithRegistry(
      <Heatmap data="ghost" x="week" y="region" value="orders" />,
      { db: dbWith(TREND_ROWS), blocks: [WEEKLY_TREND] },
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ghost");
  });

  it("shows the loading pulse at chart height while the query is in flight", async () => {
    await expectPendingPulse(
      <Heatmap data="orders" x="week" y="region" value="orders" height={180} />,
      180,
    );
  });

  it("surfaces a query failure as a named alert", async () => {
    renderWithRegistry(
      <Heatmap data="weekly_trend" x="week" y="region" value="orders" />,
      {
        db: FakeDuckDb.failing("Catalog Error: Table trend does not exist"),
        blocks: [WEEKLY_TREND],
      },
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Table trend does not exist");
    noChart();
  });

  it("shows the empty face when the query returns no rows", async () => {
    renderWithRegistry(
      <Heatmap data="weekly_trend" x="week" y="region" value="orders" />,
      { db: dbWith([]), blocks: [WEEKLY_TREND] },
    );
    expect(await screen.findByText("0 rows")).toBeInTheDocument();
    noChart();
  });

  it("shows the empty face when every value cell is non-numeric", async () => {
    renderWithRegistry(
      <Heatmap data="weekly_trend" x="week" y="region" value="orders" />,
      {
        db: dbWith([{ week: 1, region: "North", orders: "x" }]),
        blocks: [WEEKLY_TREND],
      },
    );
    expect(await screen.findByText("0 rows")).toBeInTheDocument();
    noChart();
  });

  it("alerts on each bound-column miss — x, y or value", async () => {
    const binds = { x: "week", y: "region", value: "orders" };
    for (const prop of Object.keys(binds)) {
      renderWithRegistry(
        <Heatmap data="weekly_trend" {...binds} {...{ [prop]: "nope" }} />,
        { db: dbWith(TREND_ROWS), blocks: [WEEKLY_TREND] },
      );
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent('"nope"');
      expect(alert).toHaveTextContent("week");
      cleanup();
    }
  });

  it("alerts on an unknown fmt code", async () => {
    renderWithRegistry(
      <Heatmap
        data="weekly_trend"
        x="week"
        y="region"
        value="orders"
        valueFmt="bogus"
      />,
      { db: dbWith(TREND_ROWS), blocks: [WEEKLY_TREND] },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent('fmt="bogus"');
  });

  it("takes no select prop — a heatmap publishes no selection gesture", () => {
    expectTypeOf<HeatmapChartProps>().not.toHaveProperty("select");
  });
});
