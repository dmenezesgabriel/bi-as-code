import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NodeDuckDb } from "./node-duckdb.fixture";

let db: NodeDuckDb;

beforeAll(async () => {
  db = await NodeDuckDb.open();
});

afterAll(() => db.close());

describe("toRows on the real engine", () => {
  it("hands DATE and TIMESTAMP cells out as Dates holding their wall-clock in UTC", () => {
    const rows = db.rows(
      "select DATE '2024-03-05' as day, TIMESTAMP '2024-03-05 13:45:00' as logged_at, NULL::DATE as missing",
    );

    expect(rows).toEqual([
      {
        day: new Date("2024-03-05T00:00:00Z"),
        logged_at: new Date("2024-03-05T13:45:00Z"),
        missing: null,
      },
    ]);
  });

  it("hands a decimal sum out as a number under the app's query casts", () => {
    const rows = db.rows(
      "select sum(x) as total from (values (1.5), (2.25)) t(x)",
    );

    expect(rows).toEqual([{ total: 3.75 }]);
  });

  it("binds a Date cell back as a parameter that matches its own row", () => {
    const [row] = db.rows(
      "select DATE '2024-03-05' as day, TIMESTAMP '2024-03-05 13:45:00' as logged_at",
    );

    const matches = db.rows(
      "select count(*)::int as n from (select DATE '2024-03-05' as day, TIMESTAMP '2024-03-05 13:45:00' as logged_at) where day = ? and logged_at = ?",
      [row?.["day"], row?.["logged_at"]],
    );

    expect(matches).toEqual([{ n: 1 }]);
  });
});
