import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Effect, Fiber } from "effect";
import { NodeDuckDb } from "./node-duckdb.fixture";
import { runQuery, type ResultReader } from "./run-query";

const SERIES = "select i from range(1000000) t(i) where i < ?";
const ABANDONED_ROWS = 400_000;
const KEPT_ROWS = 30_000;
// The factory numbers its connections in the order they open.
const KEPT = 1;
const ABANDONED = 2;
const COMPLETED = 3;

/** Reads `reader` to its end and returns how many rows it carried. */
async function drainedRows(reader: ResultReader): Promise<number> {
  let rows = 0;
  for (;;) {
    const read = await reader.next();
    if (read.done) return rows;
    rows += read.value.numRows;
  }
}

/** The request types posted for `connection`, in posting order. */
function postedFor(posted: readonly string[], connection: number): string[] {
  const prefix = `${connection}:`;
  return posted
    .filter((request) => request.startsWith(prefix))
    .map((request) => request.slice(prefix.length));
}

function fetchesFor(posted: readonly string[], connection: number): number {
  return postedFor(posted, connection).filter(
    (type) => type === "FETCH_QUERY_RESULTS",
  ).length;
}

let db: NodeDuckDb;

beforeAll(async () => {
  db = await NodeDuckDb.open();
}, 60_000);

afterAll(() => db.close());

describe("runQuery on the real engine", () => {
  it("reads every row of a parameterised query, then closes its statement and its connection", async () => {
    const posted: string[] = [];
    const factory = db.connectionFactory((request) => posted.push(request));

    const table = await Effect.runPromise(
      runQuery(factory, SERIES, [KEPT_ROWS]),
    );

    expect(table.numRows).toBe(KEPT_ROWS);
    expect(posted.slice(-2)).toEqual(["1:CLOSE_PREPARED", "1:DISCONNECT"]);
  });

  it("reads every row of an unparameterised query, then closes its connection", async () => {
    const posted: string[] = [];
    const factory = db.connectionFactory((request) => posted.push(request));

    const table = await Effect.runPromise(
      runQuery(factory, "select i from range(30000) t(i)"),
    );

    expect(table.numRows).toBe(KEPT_ROWS);
    expect(posted.at(0)).toBe("1:START_PENDING_QUERY");
    expect(posted.at(-1)).toBe("1:DISCONNECT");
  });

  describe("interrupted mid-read", () => {
    it("posts nothing after its disconnect and leaves a concurrent connection's stream and statement intact", async () => {
      const posted: string[] = [];
      let reachMidRead = (): void => {};
      const midRead = new Promise<void>((resolve) => (reachMidRead = resolve));
      const factory = db.connectionFactory((request) => {
        posted.push(request);
        if (fetchesFor(posted, ABANDONED) === 3) reachMidRead();
      });
      const kept = await factory.connect();
      const keptStatement = await kept.prepare(SERIES);
      const keptStream = await keptStatement.send(KEPT_ROWS);

      const fiber = Effect.runFork(runQuery(factory, SERIES, [ABANDONED_ROWS]));
      await midRead;
      await Effect.runPromise(Fiber.interrupt(fiber));
      const abandoned = postedFor(posted, ABANDONED);
      const completed = await Effect.runPromise(
        runQuery(factory, SERIES, [ABANDONED_ROWS]),
      );

      expect(abandoned.slice(-2)).toEqual(["CLOSE_PREPARED", "DISCONNECT"]);
      expect(postedFor(posted, ABANDONED)).toEqual(abandoned);
      expect(completed.numRows).toBe(ABANDONED_ROWS);
      expect(fetchesFor(posted, ABANDONED)).toBeLessThan(
        fetchesFor(posted, COMPLETED),
      );
      expect(await drainedRows(keptStream)).toBe(KEPT_ROWS);
      await expect(keptStatement.close()).resolves.toBeUndefined();
      expect(postedFor(posted, KEPT).at(-1)).toBe("CLOSE_PREPARED");
      await kept.close();
    });
  });
});
