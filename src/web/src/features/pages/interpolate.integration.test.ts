import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NodeDuckDb } from "../data/node-duckdb.fixture";
import { interpolateQuery } from "./interpolate";

let db: NodeDuckDb;

beforeAll(async () => {
  db = await NodeDuckDb.open();
});

afterAll(() => db.close());

const ISLANDS = "(values ('Dream'), ('Biscoe'), ('Torgersen')) t(island)";

/** Interpolates `sql` against `params` and runs it on the real engine. */
function rowsFor(sql: string, params: Record<string, unknown>) {
  const out = interpolateQuery(sql, { params, queries: {} });
  expect(out.errors).toEqual([]);
  return db.rows(out.sql, out.params);
}

describe("interpolateQuery against the real engine", () => {
  it("keeps the rows a list param names, through = any(...)", () => {
    const rows = rowsFor(
      `select island from ${ISLANDS} where island = any({{params.picks}}) order by island`,
      { picks: ["Dream", "Biscoe"] },
    );

    expect(rows).toEqual([{ island: "Biscoe" }, { island: "Dream" }]);
  });

  it("keeps the rows a list param names, through list_contains", () => {
    const rows = rowsFor(
      `select island from ${ISLANDS} where list_contains({{params.picks}}, island)`,
      { picks: ["Torgersen"] },
    );

    expect(rows).toEqual([{ island: "Torgersen" }]);
  });

  it("matches a numeric column against a numeric list", () => {
    const rows = rowsFor(
      "select n from (values (1), (2), (3)) t(n) where n = any({{params.picks}}) order by n",
      { picks: [1, 3] },
    );

    expect(rows).toEqual([{ n: 1 }, { n: 3 }]);
  });

  it("keeps every row when an unset list is tested for null first", () => {
    const rows = rowsFor(
      `select island from ${ISLANDS} where {{params.picks}} is null or list_contains({{params.picks}}, island) order by island`,
      {},
    );

    expect(rows).toEqual([
      { island: "Biscoe" },
      { island: "Dream" },
      { island: "Torgersen" },
    ]);
  });

  it("keeps no row for an empty list", () => {
    const rows = rowsFor(
      `select island from ${ISLANDS} where island = any({{params.picks}})`,
      { picks: [] },
    );

    expect(rows).toEqual([]);
  });
});
