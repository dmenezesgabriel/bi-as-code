import { describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import { tableFromJSON, type Table } from "apache-arrow";
import { DuckDb, type DuckDbService } from "./data-service";
import type { Row } from "./types";

class FakeDuckDb implements DuckDbService {
  registered: { name: string; source: string }[] = [];
  queried: { sql: string; params: readonly unknown[] | undefined }[] = [];
  registerTable = (name: string, source: string) => {
    this.registered.push({ name, source });
    return Effect.void;
  };
  query = (sql: string, params?: readonly unknown[]) => {
    this.queried.push({ sql, params });
    return Effect.succeed(tableFromJSON([{ n: 1 }]) as Table);
  };
  queryRows = (sql: string, params?: readonly unknown[]) => {
    this.queried.push({ sql, params });
    return Effect.succeed([{ n: 1 }] satisfies Row[]);
  };
}

describe("DuckDb service", () => {
  it("provides registerTable/query/queryRows to an effectful consumer", async () => {
    const fake = new FakeDuckDb();
    const program = Effect.gen(function* () {
      const db = yield* DuckDb;
      yield* db.registerTable("orders", "data/orders.parquet");
      return yield* db.queryRows("select * from orders");
    });

    const rows = await Effect.runPromise(
      Effect.provide(program, Layer.succeed(DuckDb, fake)),
    );

    expect(fake.registered).toEqual([
      { name: "orders", source: "data/orders.parquet" },
    ]);
    expect(rows).toEqual([{ n: 1 }]);
  });

  it("yields the service via DuckDb.use without gen syntax", async () => {
    const fake = new FakeDuckDb();
    const program = DuckDb.use((db) => db.query("select ?", [42]));

    const table = await Effect.runPromise(
      Effect.provide(program, Layer.succeed(DuckDb, fake)),
    );

    expect(fake.queried).toEqual([{ sql: "select ?", params: [42] }]);
    expect(table.numRows).toBe(1);
  });
});
