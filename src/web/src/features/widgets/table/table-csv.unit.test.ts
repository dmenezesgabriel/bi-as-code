import { describe, expect, it } from "vitest";
import type { Row } from "../../data/types";
import { toCsv } from "./table-csv";
import type { TableColumn } from "./types";

const BOM = "\ufeff";

const column = (id: string, title: string): TableColumn => ({
  id,
  title,
  format: () => "formatted",
  align: "left",
});

const REGION = column("region", "Region");
const REVENUE = column("revenue", "Revenue");

/** The one data row of a single-column CSV: BOM, header, row. */
const cellOf = (value: unknown) =>
  toCsv([{ value }], [column("value", "Value")]).split("\r\n")[1];

describe("toCsv", () => {
  it("starts with a UTF-8 byte order mark so Excel decodes accents", () => {
    const csv = toCsv([{ region: "São Paulo" }], [REGION]);

    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain("São Paulo");
  });

  it("heads each column with its title, in column order, not its id", () => {
    const rows: Row[] = [{ revenue: 6100, region: "West" }];

    const csv = toCsv(rows, [REGION, REVENUE]);

    expect(csv).toBe(`${BOM}Region,Revenue\r\nWest,6100`);
  });

  it("writes one line per row in input order, ignoring unshown keys", () => {
    const rows: Row[] = [
      { region: "West", revenue: 1, hidden: "x" },
      { region: "East", revenue: 2, hidden: "y" },
    ];

    const csv = toCsv(rows, [REGION]);

    expect(csv).toBe(`${BOM}Region\r\nWest\r\nEast`);
  });

  it("writes the raw value, never the column's display text", () => {
    const csv = toCsv([{ revenue: 6100.5 }], [REVENUE]);

    expect(csv).toBe(`${BOM}Revenue\r\n6100.5`);
    expect(csv).not.toContain("formatted");
  });

  it.each([
    ["a comma", "a,b", '"a,b"'],
    ["a newline", "a\nb", '"a\nb"'],
    ["a carriage return", "a\rb", '"a\rb"'],
    ["a double quote", 'say "hi"', '"say ""hi"""'],
  ])("quotes a cell holding %s", (_name, value, expected) => {
    expect(cellOf(value)).toBe(expected);
  });

  it("leaves a plain cell unquoted", () => {
    expect(cellOf("plain text")).toBe("plain text");
  });

  it("quotes a header title holding a comma", () => {
    const csv = toCsv([{ a: 1 }], [column("a", "Sales, USD")]);

    expect(csv).toBe(`${BOM}"Sales, USD"\r\n1`);
  });

  it.each([
    ["null", null, ""],
    ["undefined", undefined, ""],
    ["true", true, "true"],
    ["false", false, "false"],
    ["a bigint", 9007199254740993n, "9007199254740993"],
    ["zero", 0, "0"],
    ["a negative number", -5, "-5"],
  ])("writes %s as its raw text", (_name, value, expected) => {
    expect(cellOf(value)).toBe(expected);
  });

  it("writes a Date as full ISO 8601 on the UTC clock", () => {
    const value = new Date(Date.UTC(2026, 0, 5, 13, 30, 15, 250));

    expect(cellOf(value)).toBe("2026-01-05T13:30:15.250Z");
  });

  it("does not neutralise a text cell that starts like a formula", () => {
    expect(cellOf("=SUM(A1)")).toBe("=SUM(A1)");
  });

  it("writes the header alone when there are no rows", () => {
    expect(toCsv([], [REGION, REVENUE])).toBe(`${BOM}Region,Revenue`);
  });
});
