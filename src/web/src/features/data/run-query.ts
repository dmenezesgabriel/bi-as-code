import { Effect } from "effect";
import { Table, type RecordBatch, type Schema } from "apache-arrow";
import { DataError } from "./types";

/** The tail of a `send()` — duckdb's `AsyncRecordBatchStreamReader`. */
export interface ResultReader {
  readonly schema: Schema;
  readAll(): Promise<RecordBatch[]>;
}

interface PreparedStatementLike {
  send(...params: unknown[]): Promise<ResultReader>;
  close(): Promise<void>;
}

/**
 * Structural slice of `AsyncDuckDBConnection` a query needs — declared, not
 * imported, so tests drive it with plain fakes (no wasm in jsdom).
 */
export interface QueryConnection {
  send(sql: string): Promise<ResultReader>;
  prepare(sql: string): Promise<PreparedStatementLike>;
  cancelSent(): Promise<boolean>;
  close(): Promise<void>;
}

/** `AsyncDuckDB` seen from a query: just the per-query connection factory. */
export interface ConnectionFactory {
  connect(): Promise<QueryConnection>;
}

/**
 * Runs one SQL statement on a fresh connection that closes when the effect
 * finishes — success, failure or interruption alike.
 *
 * `send()` is used rather than `query()` because only sent queries answer
 * `cancelSent()`: interrupting the effect cancels the pending worker query,
 * which is what cross-filter churn needs (ADR-0005 consequence). `params`
 * bind through a prepared statement as positional `?` placeholders.
 */
export function runQuery(
  db: ConnectionFactory,
  sql: string,
  params: readonly unknown[] = [],
): Effect.Effect<Table, DataError> {
  return Effect.gen(function* () {
    const connection = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => db.connect(),
        catch: (cause) => queryError(sql, cause),
      }),
      (conn) => Effect.promise(() => conn.close()),
    );
    return yield* Effect.tryPromise({
      try: () => sendAndMaterialize(connection, sql, params),
      catch: (cause) => queryError(sql, cause),
    }).pipe(
      Effect.onInterrupt(() =>
        Effect.ignore(Effect.promise(() => connection.cancelSent())),
      ),
    );
  }).pipe(Effect.scoped);
}

async function sendAndMaterialize(
  connection: QueryConnection,
  sql: string,
  params: readonly unknown[],
): Promise<Table> {
  if (params.length === 0) {
    return materialize(await connection.send(sql));
  }
  const statement = await connection.prepare(sql);
  try {
    return await materialize(await statement.send(...params));
  } finally {
    await statement.close();
  }
}

/** Drains the stream into a Table, keeping the schema on empty results. */
async function materialize(reader: ResultReader): Promise<Table> {
  return new Table(reader.schema, await reader.readAll());
}

function queryError(sql: string, cause: unknown): DataError {
  return new DataError({ operation: "query", detail: sql, cause });
}
