import { describe, expect, it } from "vitest";
import { ColumnError, FormatError } from "../value/types";
import { defaultTableColumns, resolveTableColumns } from "./table-columns";

const ROWS = [
  { region: "West", orders: 140, revenue: 6100, share: 0.394 },
  { region: "North", orders: 120, revenue: 4800, share: 0.31 },
  { region: "South", orders: null, revenue: 3700, share: 0.296 },
];

const cellsOf = (
  columns: ReturnType<typeof defaultTableColumns>,
  row: Record<string, unknown>,
) => columns.map((column) => column.format(row[column.id]));

describe("defaultTableColumns", () => {
  it("lists every key of the first row, titled by its humanized name", () => {
    const columns = defaultTableColumns([{ order_id: 1, pct_of_total: 0.4 }]);

    expect(columns.map((c) => [c.id, c.title])).toEqual([
      ["order_id", "Order ID"],
      ["pct_of_total", "Pct of Total"],
    ]);
  });

  it("renders numbers num0 — grouped, no decimals, never unit-scaled", () => {
    const columns = defaultTableColumns(ROWS);

    expect(cellsOf(columns, ROWS[0]!)).toEqual(["West", "140", "6,100", "0"]);
  });

  it("renders bigints num0 and keeps non-numbers as their string", () => {
    const [id, day] = defaultTableColumns([
      { id: 1234567n, day: "2026-07-06" },
    ]);

    expect([id!.format(1234567n), day!.format("2026-07-06")]).toEqual([
      "1,234,567",
      "2026-07-06",
    ]);
  });

  it("renders a null cell empty", () => {
    const columns = defaultTableColumns(ROWS);

    expect(cellsOf(columns, ROWS[2]!)[1]).toBe("");
  });

  it("is empty for an empty result", () => {
    expect(defaultTableColumns([])).toEqual([]);
  });
});

describe("resolveTableColumns", () => {
  it("shows only the listed columns, in the listed order", () => {
    const columns = resolveTableColumns(ROWS, [
      { id: "revenue" },
      { id: "region" },
    ]);

    expect(columns.map((c) => c.id)).toEqual(["revenue", "region"]);
  });

  it("titles a column by its title prop verbatim, else its humanized id", () => {
    const columns = resolveTableColumns(ROWS, [
      { id: "share", title: "Share of total" },
      { id: "region" },
    ]);

    expect(columns.map((c) => c.title)).toEqual(["Share of total", "Region"]);
  });

  it("formats a fixed code on each value", () => {
    const [share] = resolveTableColumns(ROWS, [{ id: "share", fmt: "pct1" }]);

    expect(share!.format(0.394)).toBe("39.4%");
  });

  it("scales a base code against the column's range, so the column reads in one unit", () => {
    const [revenue] = resolveTableColumns(ROWS, [
      { id: "revenue", fmt: "usd" },
    ]);

    expect(ROWS.map((row) => revenue!.format(row.revenue))).toEqual([
      "$6k",
      "$5k",
      "$4k",
    ]);
  });

  it("formats an unformatted listed column like the default", () => {
    const [revenue] = resolveTableColumns(ROWS, [{ id: "revenue" }]);

    expect(revenue!.format(6100)).toBe("6,100");
  });

  it("renders a null cell empty under a fmt", () => {
    const [orders] = resolveTableColumns(ROWS, [{ id: "orders", fmt: "usd" }]);

    expect(orders!.format(null)).toBe("");
  });

  it("throws ColumnError naming a listed id the result lacks", () => {
    const resolve = () => resolveTableColumns(ROWS, [{ id: "revnue" }]);

    expect(resolve).toThrow(ColumnError);
    expect(resolve).toThrow(
      'column "revnue" is not in the result — available: region, orders, revenue, share',
    );
  });

  it("throws FormatError for an unknown fmt code", () => {
    const resolve = () =>
      resolveTableColumns(ROWS, [{ id: "revenue", fmt: "dollars" }]);

    expect(resolve).toThrow(FormatError);
  });

  it("throws FormatError for a fmt the column's values cannot take", () => {
    const resolve = () =>
      resolveTableColumns(ROWS, [{ id: "region", fmt: "usd" }]);

    expect(resolve).toThrow('fmt="usd"');
  });

  it("checks nothing against an empty result", () => {
    const columns = resolveTableColumns([], [{ id: "revnue", fmt: "usd" }]);

    expect(columns.map((c) => c.id)).toEqual(["revnue"]);
  });
});
