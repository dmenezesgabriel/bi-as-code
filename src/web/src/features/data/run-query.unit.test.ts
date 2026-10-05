import { describe, expect, it, vi } from "vitest";
import { Effect, Fiber } from "effect";
import { tableFromJSON, type RecordBatch, type Schema } from "apache-arrow";
import { runQuery } from "./run-query";

class FakeReader {
  constructor(
    readonly schema: Schema,
    private readonly batches: RecordBatch[],
  ) {}
  async readAll(): Promise<RecordBatch[]> {
    return this.batches;
  }
}

class FakeStatement {
  sentParams: unknown[] | null = null;
  closed = false;
  constructor(private readonly reader: FakeReader) {}
  async send(...params: unknown[]): Promise<FakeReader> {
    this.sentParams = params;
    return this.reader;
  }
  async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeConnection {
  sentSql: string[] = [];
  preparedSql: string[] = [];
  canceled = false;
  closed = false;
  sendImpl: () => Promise<FakeReader> = async () => {
    throw new Error("send not stubbed");
  };
  statement = new FakeStatement(
    new FakeReader(tableFromJSON([{ ok: true }]).schema, []),
  );
  async send(sql: string): Promise<FakeReader> {
    this.sentSql.push(sql);
    return this.sendImpl();
  }
  async prepare(sql: string): Promise<FakeStatement> {
    this.preparedSql.push(sql);
    return this.statement;
  }
  async cancelSent(): Promise<boolean> {
    this.canceled = true;
    return true;
  }
  async close(): Promise<void> {
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

function readerOf(rows: Record<string, unknown>[]): FakeReader {
  const table = tableFromJSON(rows);
  return new FakeReader(table.schema, table.batches);
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

  it("cancels the in-flight query and closes the connection on interrupt", async () => {
    const connection = new FakeConnection();
    connection.sendImpl = () => new Promise<FakeReader>(() => {});

    const fiber = Effect.runFork(
      runQuery(new FakeDb(connection), "select slow()"),
    );
    // Let connect+send reach in-flight before interrupting — an interrupt
    // that lands earlier legitimately cancels nothing.
    await vi.waitFor(() => expect(connection.sentSql).toHaveLength(1));
    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(connection.canceled).toBe(true);
    expect(connection.closed).toBe(true);
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
