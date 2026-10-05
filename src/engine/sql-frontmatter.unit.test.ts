import { describe, expect, it } from "vitest";
import { assertNoSqlTableCollision, sqlTableMap } from "./sql-frontmatter.js";

const LOCATION = "front-matter in pages/page.md";

describe("sqlTableMap", () => {
  it("yields an empty map when no sql map is declared", () => {
    expect(sqlTableMap(undefined, LOCATION)).toEqual({});
    expect(sqlTableMap({}, LOCATION)).toEqual({});
  });

  it("maps a table name to its normalized data/ path", () => {
    const tables = sqlTableMap({ orders: "data/orders.csv" }, LOCATION);

    expect(tables).toEqual({ orders: "data/orders.csv" });
  });

  it("normalizes a leading ./ into the data/ prefix", () => {
    const tables = sqlTableMap({ orders: "./data/orders.parquet" }, LOCATION);

    expect(tables).toEqual({ orders: "data/orders.parquet" });
  });

  it("accepts every supported file extension", () => {
    const tables = sqlTableMap(
      {
        a: "data/a.csv",
        b: "data/b.json",
        c: "data/c.arrow",
        d: "data/d.parquet",
      },
      LOCATION,
    );

    expect(Object.keys(tables)).toEqual(["a", "b", "c", "d"]);
  });

  it("throws naming the location and shape when sql is not a mapping", () => {
    expect(() => sqlTableMap("data/orders.csv", LOCATION)).toThrow(
      /Invalid front-matter in pages\/page\.md — sql: expected a mapping.*got "data\/orders\.csv"/,
    );
  });

  it("labels errors with the declaring source", () => {
    expect(() => sqlTableMap("data/orders.csv", "biac.config.ts")).toThrow(
      /Invalid biac\.config\.ts — sql: expected a mapping/,
    );
  });

  it("throws for a null sql key rather than treating it as absent", () => {
    expect(() => sqlTableMap(null, LOCATION)).toThrow(
      /sql: expected a mapping.*got null/,
    );
  });

  it("throws for an array sql key", () => {
    expect(() => sqlTableMap(["data/a.csv"], LOCATION)).toThrow(
      /sql: expected a mapping.*got \[/,
    );
  });

  it("throws naming the entry when a source is not a string", () => {
    expect(() => sqlTableMap({ orders: 42 }, LOCATION)).toThrow(
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
    expect(() => sqlTableMap({ orders: source }, LOCATION)).toThrow(
      /sql\.orders: expected a "data\/…" path ending .*got/,
    );
  });

  it("throws for an unsupported file extension", () => {
    expect(() => sqlTableMap({ orders: "data/orders.txt" }, LOCATION)).toThrow(
      /sql\.orders: expected .*\.csv.*\.json.*\.arrow.*\.parquet.*got.*orders\.txt/,
    );
  });

  it("throws for a bare data/ path with no file", () => {
    expect(() => sqlTableMap({ orders: "data/" }, LOCATION)).toThrow(
      /sql\.orders: expected/,
    );
  });

  it("throws for an empty table name", () => {
    expect(() => sqlTableMap({ "": "data/orders.csv" }, LOCATION)).toThrow(
      /sql: expected a non-empty table name.*got ""/,
    );
  });
});

describe("assertNoSqlTableCollision", () => {
  it("passes when page and config declare disjoint names", () => {
    expect(() =>
      assertNoSqlTableCollision(
        { orders: "data/orders.csv" },
        { other: "data/other.csv" },
        LOCATION,
      ),
    ).not.toThrow();
  });

  it("passes when either map is empty", () => {
    expect(() =>
      assertNoSqlTableCollision({}, { orders: "data/o.csv" }, LOCATION),
    ).not.toThrow();
    expect(() =>
      assertNoSqlTableCollision({ orders: "data/o.csv" }, {}, LOCATION),
    ).not.toThrow();
  });

  it("throws naming the page location, biac.config.ts and both paths", () => {
    expect(() =>
      assertNoSqlTableCollision(
        { orders: "data/orders.csv" },
        { orders: "data/shared.parquet" },
        LOCATION,
      ),
    ).toThrow(
      /Invalid front-matter in pages\/page\.md — sql\.orders: expected a name not already declared by biac\.config\.ts \("data\/shared\.parquet"\), got "data\/orders\.csv"/,
    );
  });
});
