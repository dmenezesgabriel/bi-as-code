import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Table } from "apache-arrow";
import { toRows } from "./to-rows";
import type { Row } from "./types";

/** The slice of duckdb-wasm's blocking prepared statement a test runs. */
interface BlockingStatement {
  query(...params: unknown[]): Table;
  close(): void;
}

/** The slice of duckdb-wasm's blocking connection a test runs. */
interface BlockingConnection {
  query(sql: string): Table;
  prepare(sql: string): BlockingStatement;
  close(): void;
}

/** The slice of duckdb-wasm's node blocking bindings that opens an engine. */
interface BlockingBindings {
  createDuckDB(
    bundles: Record<string, { mainModule: string }>,
    logger: unknown,
    runtime: unknown,
  ): Promise<{ instantiate(): Promise<void>; connect(): BlockingConnection }>;
  VoidLogger: new () => unknown;
  NODE_RUNTIME: unknown;
}

const webRoot = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * A real duckdb engine for integration tests — the same duckdb-wasm build
 * the browser runs, through its node blocking bindings — answering SQL as
 * the app's `Row[]` (via the app's own `toRows`).
 *
 * @example
 * const db = await NodeDuckDb.open();
 * db.rows("select ? as n", [1]); // → [{ n: 1 }]
 */
export class NodeDuckDb {
  private constructor(private readonly connection: BlockingConnection) {}

  static async open(): Promise<NodeDuckDb> {
    const require = createRequire(join(webRoot, "package.json"));
    const dist = dirname(
      require.resolve("@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs"),
    );
    const duckdb = require(
      join(dist, "duckdb-node-blocking.cjs"),
    ) as BlockingBindings;
    const db = await duckdb.createDuckDB(
      {
        mvp: { mainModule: join(dist, "duckdb-mvp.wasm") },
        eh: { mainModule: join(dist, "duckdb-eh.wasm") },
      },
      new duckdb.VoidLogger(),
      duckdb.NODE_RUNTIME,
    );
    await db.instantiate();
    return new NodeDuckDb(db.connect());
  }

  /** Runs `sql`, binding `params` to its `?` holes when any are given. */
  rows(sql: string, params: readonly unknown[] = []): Row[] {
    if (params.length === 0) return toRows(this.connection.query(sql));
    const statement = this.connection.prepare(sql);
    try {
      return toRows(statement.query(...params));
    } finally {
      statement.close();
    }
  }

  close(): void {
    this.connection.close();
  }
}
