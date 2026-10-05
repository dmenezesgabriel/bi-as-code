import { describe, expect, it } from "vitest";
import { sqlTableMap } from "./sql-frontmatter.js";

const FILE = "pages/page.md";

describe("sqlTableMap", () => {
  it("yields an empty map when the page declares no sql key", () => {
    expect(sqlTableMap({}, FILE)).toEqual({});
  });

  it("maps a table name to its normalized data/ path", () => {
    const tables = sqlTableMap({ sql: { orders: "data/orders.csv" } }, FILE);

    expect(tables).toEqual({ orders: "data/orders.csv" });
  });

  it("normalizes a leading ./ into the data/ prefix", () => {
    const tables = sqlTableMap(
      { sql: { orders: "./data/orders.parquet" } },
      FILE,
    );

    expect(tables).toEqual({ orders: "data/orders.parquet" });
  });

  it("accepts every supported file extension", () => {
    const tables = sqlTableMap(
      {
        sql: {
          a: "data/a.csv",
          b: "data/b.json",
          c: "data/c.arrow",
          d: "data/d.parquet",
        },
      },
      FILE,
    );

    expect(Object.keys(tables)).toEqual(["a", "b", "c", "d"]);
  });

  it("throws naming the file and shape when sql is not a mapping", () => {
    expect(() => sqlTableMap({ sql: "data/orders.csv" }, FILE)).toThrow(
      /Invalid front-matter in pages\/page\.md — sql: expected a mapping.*got "data\/orders\.csv"/,
    );
  });

  it("throws for a null sql key rather than treating it as absent", () => {
    expect(() => sqlTableMap({ sql: null }, FILE)).toThrow(
      /sql: expected a mapping.*got null/,
    );
  });

  it("throws for an array sql key", () => {
    expect(() => sqlTableMap({ sql: ["data/a.csv"] }, FILE)).toThrow(
      /sql: expected a mapping.*got \[/,
    );
  });

  it("throws naming the entry when a source is not a string", () => {
    expect(() => sqlTableMap({ sql: { orders: 42 } }, FILE)).toThrow(
      /sql\.orders: expected a string path.*got 42/,
    );
  });

  it.each([
    "pages/orders.csv",
    "data/../orders.csv",
    "data/../../etc/passwd.csv",
    "/abs/orders.csv",
    "https://example.com/orders.csv",
    "data\\orders.csv",
  ])("throws for a source outside data/: %s", (source) => {
    expect(() => sqlTableMap({ sql: { orders: source } }, FILE)).toThrow(
      /sql\.orders: expected a "data\/…" path ending .*got/,
    );
  });

  it("throws for an unsupported file extension", () => {
    expect(() =>
      sqlTableMap({ sql: { orders: "data/orders.txt" } }, FILE),
    ).toThrow(
      /sql\.orders: expected .*\.csv.*\.json.*\.arrow.*\.parquet.*got.*orders\.txt/,
    );
  });

  it("throws for a bare data/ path with no file", () => {
    expect(() => sqlTableMap({ sql: { orders: "data/" } }, FILE)).toThrow(
      /sql\.orders: expected/,
    );
  });

  it("throws for an empty table name", () => {
    expect(() => sqlTableMap({ sql: { "": "data/orders.csv" } }, FILE)).toThrow(
      /sql: expected a non-empty table name.*got ""/,
    );
  });
});
