import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { SqlBlock } from "../../pages/types";
import { BigValue } from "./big-value";
import {
  dbWith,
  filteredDbWith,
  KPI,
  KPI_ROWS,
  WEEKLY,
  WEEKLY_ROWS,
  WEST_KPI_ROWS,
} from "./big-value.fixture";
import { renderWithRegistry } from "./registry-harness";
import type { BigValueProps } from "./types";

function renderBigValue(
  props: Partial<BigValueProps> = {},
  {
    db = dbWith(KPI_ROWS),
    blocks = [KPI, WEEKLY],
    provider = true,
    url,
  }: {
    db?: FakeDuckDb;
    blocks?: readonly SqlBlock[];
    provider?: boolean;
    url?: string;
  } = {},
) {
  return renderWithRegistry(<BigValue data="kpi" {...props} />, {
    db,
    blocks,
    provider,
    url,
  });
}

describe("BigValue", () => {
  it("wraps both the value fence and the sparkline fence with the filter's predicate", async () => {
    const db = filteredDbWith(WEST_KPI_ROWS, WEEKLY_ROWS.slice(0, 5));
    renderBigValue(
      {
        column: "revenue",
        fmt: "usd",
        sparkline: "weekly_revenue",
        filters: "region",
      },
      { db, url: "?region=West" },
    );

    expect(await screen.findByText("$500")).toBeInTheDocument();
    expect(screen.queryByText("$1.2M")).toBeNull();
    expect(await screen.findByRole("img")).toBeInTheDocument();
    expect(db.queries).toContainEqual({
      sql: "select * from (select revenue, wow_pct, orders from orders) where region = ?",
      params: ["West"],
    });
    expect(db.queries).toContainEqual({
      sql: "select * from (select week, revenue from weekly) where region = ?",
      params: ["West"],
    });
  });

  it("composes title, formatted value, delta and sparkline", async () => {
    renderBigValue({
      column: "revenue",
      title: "Quarter revenue",
      fmt: "usd",
      delta: "wow_pct",
      deltaFmt: "pct1",
      text: "last week vs. prior",
      sparkline: "weekly_revenue",
    });

    expect(await screen.findByText("Quarter revenue")).toBeInTheDocument();
    expect(screen.getByText("$1.2M")).toBeInTheDocument();
    expect(screen.getByText("+5.2%")).toBeInTheDocument();
    expect(screen.getByText("last week vs. prior")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("sets the figure and its delta in tabular numerals", async () => {
    renderBigValue({
      column: "revenue",
      fmt: "usd",
      delta: "wow_pct",
      deltaFmt: "pct1",
    });

    const figure = await screen.findByText("$1.2M");
    expect(figure.closest(".tabular-nums")).not.toBeNull();
    expect(screen.getByText("+5.2%").closest(".tabular-nums")).not.toBeNull();
  });

  it("renders only the value when no dressing props are set", async () => {
    renderBigValue({ column: "revenue", fmt: "usd" });

    expect(await screen.findByText("$1.2M")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("defaults the title to the named column", async () => {
    renderBigValue({ column: "revenue" });

    expect(await screen.findByText("revenue")).toBeInTheDocument();
    expect(screen.getByText("1.2M")).toBeInTheDocument();
  });

  it("picks the row's first key when column is unset", async () => {
    renderBigValue({});

    expect(await screen.findByText("revenue")).toBeInTheDocument();
    expect(screen.getByText("1.2M")).toBeInTheDocument();
  });

  it("reads the cell at the row index when row is set", async () => {
    renderBigValue(
      { column: "revenue", row: 1 },
      {
        db: dbWith([
          { revenue: 100, wow_pct: 0.01 },
          { revenue: 200, wow_pct: -0.02 },
        ]),
      },
    );

    expect(await screen.findByText("200")).toBeInTheDocument();
  });

  it("renders a block-level tree so block MDX contexts stay valid", async () => {
    renderBigValue({ column: "revenue", title: "Quarter revenue" });

    const value = await screen.findByText("1.2M");
    const root = value.closest("span.block");
    expect(root).not.toBeNull();
    expect(root?.querySelector("div")).toBeNull();
  });

  it("shows – under the title and hides delta and sparkline when empty", async () => {
    renderBigValue(
      {
        column: "revenue",
        title: "Quarter revenue",
        delta: "wow_pct",
        deltaFmt: "pct1",
        sparkline: "weekly_revenue",
      },
      { db: dbWith([], []) },
    );

    expect(await screen.findByText("Quarter revenue")).toBeInTheDocument();
    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("hides the sparkline alone when its own query is empty", async () => {
    renderBigValue(
      {
        column: "revenue",
        delta: "wow_pct",
        deltaFmt: "pct1",
        sparkline: "weekly_revenue",
      },
      { db: dbWith(KPI_ROWS, []) },
    );

    expect(await screen.findByText("1.2M")).toBeInTheDocument();
    expect(screen.getByText("+5.2%")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("hides the delta alone when its cell is null", async () => {
    renderBigValue(
      {
        column: "revenue",
        delta: "wow_pct",
        deltaFmt: "pct1",
        sparkline: "weekly_revenue",
      },
      { db: dbWith([{ revenue: 1234567, wow_pct: null }]) },
    );

    expect(await screen.findByText("1.2M")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.queryByText("+5.2%")).toBeNull();
  });

  it("renders the same unknown-name alert outside a query registry", async () => {
    renderBigValue({}, { provider: false });

    expect(await screen.findByRole("alert")).toHaveTextContent("kpi");
  });

  it.each([
    { case: "unknown data name", props: { data: "ghost" }, want: "ghost" },
    { case: "unknown column", props: { column: "sales" }, want: '"sales"' },
    {
      case: "unknown delta column",
      props: { column: "revenue", delta: "qoq_pct" },
      want: '"qoq_pct"',
    },
    {
      case: "unknown fmt",
      props: { column: "revenue", fmt: "bogus" },
      want: 'fmt="bogus"',
    },
    {
      case: "unknown deltaFmt",
      props: { column: "revenue", delta: "wow_pct", deltaFmt: "bogus" },
      want: 'fmt="bogus"',
    },
    {
      case: "unknown sparkline query",
      props: { column: "revenue", sparkline: "ghost_series" },
      want: "ghost_series",
    },
    {
      case: "unknown sparklineY column",
      props: {
        column: "revenue",
        sparkline: "weekly_revenue",
        sparklineY: "sales",
      },
      want: '"sales"',
    },
    {
      case: "failed query",
      props: { column: "revenue" },
      db: FakeDuckDb.failing("Catalog Error: Table orders does not exist"),
      want: "Table orders does not exist",
    },
  ])(
    "renders an inline alert on $case",
    async ({ props, want, db = dbWith(KPI_ROWS) }) => {
      renderBigValue(props, { db });

      expect(await screen.findByRole("alert")).toHaveTextContent(want);
    },
  );

  it("lists the available columns when column is unknown", async () => {
    renderBigValue({ column: "sales" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "revenue, wow_pct, orders",
    );
  });

  it("pulses a placeholder while the query is in flight", async () => {
    renderBigValue({ column: "revenue" }, { db: FakeDuckDb.pending() });

    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("marks a negative delta good under downIsGood", async () => {
    renderBigValue(
      {
        column: "revenue",
        delta: "wow_pct",
        deltaFmt: "pct1",
        downIsGood: true,
      },
      { db: dbWith([{ revenue: 100, wow_pct: -0.041 }]) },
    );

    const delta = await screen.findByText("-4.1%");
    expect(delta.closest("[data-status]")).toHaveAttribute(
      "data-status",
      "negative",
    );
    expect(delta.closest("[data-status]")?.className).toContain(
      "text-positive",
    );
  });

  it("places the delta arrow left of the value by default", async () => {
    renderBigValue({ column: "revenue", delta: "wow_pct", deltaFmt: "pct1" });

    const shown = await screen.findByText("+5.2%");
    const svg = shown.parentElement?.querySelector("svg");
    expect(shown.previousElementSibling?.contains(svg ?? null)).toBe(true);
  });

  it("renders the delta as a tinted chip when chip is set", async () => {
    renderBigValue({
      column: "revenue",
      delta: "wow_pct",
      deltaFmt: "pct1",
      chip: true,
    });

    const shown = await screen.findByText("+5.2%");
    expect(shown.closest("[data-status]")?.className).toContain("border");
  });
});
