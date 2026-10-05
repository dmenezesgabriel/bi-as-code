import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { SqlBlock } from "../../pages/types";
import { Delta } from "./delta";
import { renderWithRegistry } from "./registry-harness";
import type { DeltaProps } from "./types";

const KPI: SqlBlock = {
  name: "kpi",
  sql: "select revenue, wow_pct from orders",
};

function renderDelta(
  props: Partial<DeltaProps> = {},
  { db = new FakeDuckDb(), blocks = [KPI], provider = true } = {},
) {
  return renderWithRegistry(<Delta data="kpi" {...props} />, {
    db,
    blocks,
    provider,
  });
}

/** The DeltaDisplay root — the only element carrying `data-status`. */
const statusRoot = (): HTMLElement =>
  document.querySelector<HTMLElement>("[data-status]")!;

describe("Delta", () => {
  it("renders the named column as a signed, arrowed delta", async () => {
    renderDelta(
      { column: "wow_pct", fmt: "pct1" },
      { db: FakeDuckDb.withRows([{ revenue: 1234567, wow_pct: 0.052 }]) },
    );

    await screen.findByText("+5.2%");
    const el = statusRoot();
    expect(el).toHaveAttribute("data-status", "positive");
    expect(el.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("defaults column to the row's first key", async () => {
    renderDelta(
      { fmt: "pct1" },
      { db: FakeDuckDb.withRows([{ wow_pct: -0.041, revenue: 100 }]) },
    );

    await screen.findByText("-4.1%");
    expect(statusRoot()).toHaveAttribute("data-status", "negative");
  });

  it("reads the cell at the row index when row is set", async () => {
    renderDelta(
      { column: "wow_pct", fmt: "pct1", row: 1 },
      { db: FakeDuckDb.withRows([{ wow_pct: 0.01 }, { wow_pct: -0.02 }]) },
    );

    await screen.findByText("-2.0%");
    expect(statusRoot()).toHaveAttribute("data-status", "negative");
  });

  it("passes the text caption through", async () => {
    renderDelta(
      { column: "wow_pct", fmt: "pct1", text: "WoW" },
      { db: FakeDuckDb.withRows([{ wow_pct: 0.052 }]) },
    );

    expect(await screen.findByText("WoW")).toBeInTheDocument();
  });

  it("renders as a chip when chip is set", async () => {
    renderDelta(
      { column: "wow_pct", fmt: "pct1", chip: true },
      { db: FakeDuckDb.withRows([{ wow_pct: 0.052 }]) },
    );

    await screen.findByText("+5.2%");
    expect(statusRoot().className).toContain("border");
  });

  it("inverts the palette under downIsGood", async () => {
    renderDelta(
      { column: "wow_pct", fmt: "pct1", downIsGood: true },
      { db: FakeDuckDb.withRows([{ wow_pct: -0.041 }]) },
    );

    await screen.findByText("-4.1%");
    const el = statusRoot();
    expect(el).toHaveAttribute("data-status", "negative");
    expect(el.className).toContain("text-emerald-");
  });

  it("honors neutralRange for small wobbles", async () => {
    renderDelta(
      { column: "wow_pct", fmt: "pct1", neutralRange: [-0.05, 0.05] },
      { db: FakeDuckDb.withRows([{ wow_pct: 0.02 }]) },
    );

    await screen.findByText("2.0%");
    expect(statusRoot()).toHaveAttribute("data-status", "neutral");
  });

  it("drops the arrow when showSymbol is off", async () => {
    renderDelta(
      { column: "wow_pct", fmt: "pct1", showSymbol: false },
      { db: FakeDuckDb.withRows([{ wow_pct: 0.052 }]) },
    );

    await screen.findByText("+5.2%");
    expect(statusRoot().querySelector("svg")).toBeNull();
  });

  it("puts the arrow before the value under symbolPosition=left", async () => {
    renderDelta(
      { column: "wow_pct", fmt: "pct1", symbolPosition: "left" },
      { db: FakeDuckDb.withRows([{ wow_pct: 0.052 }]) },
    );

    await screen.findByText("+5.2%");
    const html = statusRoot().innerHTML;
    expect(html.indexOf("<svg")).toBeLessThan(html.indexOf("+5.2%"));
  });

  it("hides the value when showValue is off", async () => {
    renderDelta(
      { column: "wow_pct", fmt: "pct1", showValue: false },
      { db: FakeDuckDb.withRows([{ wow_pct: 0.052 }]) },
    );

    await waitFor(() => expect(statusRoot()).not.toBeNull());
    expect(statusRoot().querySelector("svg")).not.toBeNull();
    expect(statusRoot()).not.toHaveTextContent("5.2%");
  });

  it("renders an inline alert naming a data value no sql block declares", async () => {
    renderDelta({ data: "ghost" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ghost");
  });

  it("renders an inline alert with the query's message when it fails", async () => {
    renderDelta(
      {},
      { db: FakeDuckDb.failing("Catalog Error: Table orders does not exist") },
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Table orders does not exist");
  });

  it("pulses a placeholder while the query is in flight", async () => {
    renderDelta({}, { db: FakeDuckDb.pending() });

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(document.querySelector("[data-status]")).toBeNull();
  });

  it("renders an en dash when the query returns no rows", async () => {
    renderDelta({}, { db: FakeDuckDb.withRows([]) });

    expect(await screen.findByText("–")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("alerts naming an unknown column and the available ones", async () => {
    renderDelta(
      { column: "delta" },
      { db: FakeDuckDb.withRows([{ revenue: 100, wow_pct: 0.05 }]) },
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('"delta"');
    expect(alert).toHaveTextContent("revenue, wow_pct");
  });

  it("alerts naming an unknown fmt code", async () => {
    renderDelta(
      { column: "wow_pct", fmt: "bogus" },
      { db: FakeDuckDb.withRows([{ wow_pct: 0.052 }]) },
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('fmt="bogus"');
  });
});
