import { describe, expect, it, vi } from "vitest";
import { Effect, Fiber } from "effect";
import { tableFromJSON, type RecordBatch, type Schema } from "apache-arrow";
import { runQuery } from "./run-query";

/** A promise the test settles by hand — it holds a fake call in flight. */
class HeldCall<T> {
  resolve!: (value: T) => void;
  reject!: (cause: Error) => void;
  readonly promise = new Promise<T>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
}

/**
 * The fakes share one `calls` log, so a test can assert the order requests
 * reach the connection — after `close` the engine has freed it.
 */
class FakeReader {
  /** Set to keep every `next()` in flight until the test settles it. */
  held: HeldCall<void> | null = null;
  private served = 0;
  constructor(
    readonly schema: Schema,
    private readonly batches: RecordBatch[],
    private readonly calls: string[] = [],
  ) {}
  async next(): Promise<IteratorResult<RecordBatch>> {
    this.calls.push("reader.next");
    if (this.held) await this.held.promise;
    this.calls.push("reader.next settled");
    const batch = this.batches[this.served++];
    return batch
      ? { done: false, value: batch }
      : { done: true, value: undefined };
  }
}

class FakeStatement {
  sentParams: unknown[] | null = null;
  closed = false;
  constructor(
    private readonly reader: FakeReader,
    private readonly calls: string[] = [],
  ) {}
  async send(...params: unknown[]): Promise<FakeReader> {
    this.calls.push("statement.send");
    this.sentParams = params;
    return this.reader;
  }
  async close(): Promise<void> {
    this.calls.push("statement.close");
    this.closed = true;
  }
}

class FakeConnection {
  readonly calls: string[] = [];
  sentSql: string[] = [];
  preparedSql: string[] = [];
  closed = false;
  sendImpl: () => Promise<FakeReader> = async () => {
    throw new Error("send not stubbed");
  };
  /** What the engine does to the query in flight when it is cancelled. */
  onCancel: () => void = () => {};
  statement = new FakeStatement(
    new FakeReader(tableFromJSON([{ ok: true }]).schema, []),
  );
  async send(sql: string): Promise<FakeReader> {
    this.calls.push("send");
    this.sentSql.push(sql);
    return this.sendImpl();
  }
  async prepare(sql: string): Promise<FakeStatement> {
    this.calls.push("prepare");
    this.preparedSql.push(sql);
    return this.statement;
  }
  async cancelSent(): Promise<boolean> {
    this.calls.push("cancelSent");
    this.onCancel();
    return true;
  }
  async close(): Promise<void> {
    this.calls.push("close");
    this.closed = true;
  }
}

class FakeDb {
  connectCalls = 0;
  constructor(readonly connection: FakeConnection) {}
  async connect(): Promise<FakeConnection> {
    this.connectCalls += 1;
    return this.connection;
  }
}

function readerOf(
  rows: Record<string, unknown>[],
  calls: string[] = [],
): FakeReader {
  const table = tableFromJSON(rows);
  return new FakeReader(table.schema, table.batches, calls);
}

/** A two-batch reader whose reads stay in flight until `held` settles. */
function heldReaderOf(calls: string[]): FakeReader {
  const batches = [
    ...tableFromJSON([{ n: 1 }]).batches,
    ...tableFromJSON([{ n: 2 }]).batches,
  ];
  const reader = new FakeReader(batches[0]!.schema, batches, calls);
  reader.held = new HeldCall<void>();
  return reader;
}

/** Lets every already-queued fake call run before the next assertion. */
function queuedCallsRun(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

/**
 * Interrupts `fiber` once `reader`'s read is in flight, checks the
 * connection stays open while that read is pending, then lets it settle.
 */
async function interruptMidRead(
  fiber: Fiber.Fiber<unknown, unknown>,
  connection: FakeConnection,
  reader: FakeReader,
): Promise<void> {
  await vi.waitFor(() => expect(connection.calls).toContain("reader.next"));
  const interrupted = Effect.runPromise(Fiber.interrupt(fiber));
  await vi.waitFor(() => expect(connection.calls).toContain("cancelSent"));
  await queuedCallsRun();
  expect(connection.calls).not.toContain("close");
  reader.held?.resolve(undefined);
  await interrupted;
  await queuedCallsRun();
}

describe("runQuery", () => {
  it("sends the SQL and materializes the stream into a Table", async () => {
    const connection = new FakeConnection();
    connection.sendImpl = async () =>
      readerOf([{ region: "West" }, { region: "East" }]);

    const table = await Effect.runPromise(
      runQuery(new FakeDb(connection), "select * from orders"),
    );

    expect(connection.sentSql).toEqual(["select * from orders"]);
    expect(table.numRows).toBe(2);
    expect(table.schema.fields.map((f) => f.name)).toEqual(["region"]);
    expect(connection.closed).toBe(true);
  });

  it("binds params through a prepared statement and closes it", async () => {
    const connection = new FakeConnection();
    connection.statement = new FakeStatement(readerOf([{ n: 5 }]));

    const table = await Effect.runPromise(
      runQuery(new FakeDb(connection), "select ? as n", [5, "x"]),
    );

    expect(connection.preparedSql).toEqual(["select ? as n"]);
    expect(connection.statement.sentParams).toEqual([5, "x"]);
    expect(connection.statement.closed).toBe(true);
    expect(connection.sentSql).toEqual([]);
    expect(table.numRows).toBe(1);
  });

  describe("interrupted", () => {
    it("cancels a query still being sent, then closes the connection", async () => {
      const connection = new FakeConnection();
      const sending = new HeldCall<FakeReader>();
      connection.sendImpl = () => sending.promise;
      connection.onCancel = () => sending.reject(new Error("interrupted"));

      const fiber = Effect.runFork(
        runQuery(new FakeDb(connection), "select slow()"),
      );
      // Let connect+send reach in-flight before interrupting — an interrupt
      // that lands earlier legitimately cancels nothing.
      await vi.waitFor(() => expect(connection.sentSql).toHaveLength(1));
      await Effect.runPromise(Fiber.interrupt(fiber));
      await queuedCallsRun();

      expect(connection.calls).toEqual(["send", "cancelSent", "close"]);
    });

    it("closes the connection only after the read in flight settled, and reads no further", async () => {
      const connection = new FakeConnection();
      const reader = heldReaderOf(connection.calls);
      connection.sendImpl = async () => reader;

      const fiber = Effect.runFork(
        runQuery(new FakeDb(connection), "select * from flights"),
      );
      await interruptMidRead(fiber, connection, reader);

      expect(connection.calls).toEqual([
        "send",
        "reader.next",
        "cancelSent",
        "reader.next settled",
        "close",
      ]);
    });

    it("closes the prepared statement before the connection, and nothing after it", async () => {
      const connection = new FakeConnection();
      const reader = heldReaderOf(connection.calls);
      connection.statement = new FakeStatement(reader, connection.calls);

      const fiber = Effect.runFork(
        runQuery(new FakeDb(connection), "select ? as n", [5]),
      );
      await interruptMidRead(fiber, connection, reader);

      expect(connection.calls).toEqual([
        "prepare",
        "statement.send",
        "reader.next",
        "cancelSent",
        "reader.next settled",
        "statement.close",
        "close",
      ]);
    });
  });

  it("maps a failed query to a DataError naming the SQL", async () => {
    const connection = new FakeConnection();
    connection.sendImpl = async () => {
      throw new Error("Parser Error: no such table");
    };

    const exit = await Effect.runPromiseExit(
      runQuery(new FakeDb(connection), "select * from missing"),
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const error = exit.cause;
      expect(String(error)).toContain("Parser Error");
    }
    expect(connection.closed).toBe(true);
  });
});
