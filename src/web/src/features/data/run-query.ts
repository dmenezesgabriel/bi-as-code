import { Effect, type Scope } from "effect";
import { Table, type RecordBatch, type Schema } from "apache-arrow";
import { DataError } from "./types";

/** The tail of a `send()` — duckdb's `AsyncRecordBatchStreamReader`. */
export interface ResultReader {
  readonly schema: Schema;
  next(): Promise<IteratorResult<RecordBatch>>;
}

export interface PreparedStatementLike {
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
 *
 * An interrupted run stops reading at the next batch and is waited for
 * before the connection closes: duckdb-wasm frees a connection on
 * disconnect and checks no handle afterwards, so a fetch or a statement
 * close posted later would run on freed memory.
 *
 * @example
 * const table = await Effect.runPromise(runQuery(db, "select ? as n", [1]));
 */
export function runQuery(
  db: ConnectionFactory,
  sql: string,
  params: readonly unknown[] = [],
): Effect.Effect<Table, DataError> {
  return Effect.gen(function* () {
    const connection = yield* scopedConnection(db, sql);
    const abandoned = new AbortController();
    const reading = sendAndMaterialize(
      connection,
      sql,
      params,
      abandoned.signal,
    );
    return yield* Effect.tryPromise({
      try: () => reading,
      catch: (cause) => queryError(sql, cause),
    }).pipe(
      Effect.onInterrupt(() => stopReading(connection, abandoned, reading)),
    );
  }).pipe(Effect.scoped);
}

/** A fresh connection that closes when the enclosing scope does. */
function scopedConnection(
  db: ConnectionFactory,
  sql: string,
): Effect.Effect<QueryConnection, DataError, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.tryPromise({
      try: () => db.connect(),
      catch: (cause) => queryError(sql, cause),
    }),
    (connection) => Effect.promise(() => connection.close()),
  );
}

/**
 * Abandons `reading` and waits for it to settle either way, so its last
 * request is posted before the scope's release posts the disconnect.
 */
function stopReading(
  connection: QueryConnection,
  abandoned: AbortController,
  reading: Promise<Table>,
): Effect.Effect<void> {
  return Effect.promise(async () => {
    abandoned.abort();
    await Promise.allSettled([connection.cancelSent(), reading]);
  });
}

async function sendAndMaterialize(
  connection: QueryConnection,
  sql: string,
  params: readonly unknown[],
  abandoned: AbortSignal,
): Promise<Table> {
  if (params.length === 0) {
    return materialize(await connection.send(sql), abandoned);
  }
  const statement = await connection.prepare(sql);
  try {
    return await materialize(await statement.send(...params), abandoned);
  } finally {
    await statement.close();
  }
}

/**
 * Drains the stream into a Table, keeping the schema on empty results.
 * Once `abandoned` it asks for no further batch — the partial Table goes
 * to an interrupted run, which discards it.
 */
async function materialize(
  reader: ResultReader,
  abandoned: AbortSignal,
): Promise<Table> {
  const batches: RecordBatch[] = [];
  while (!abandoned.aborted) {
    const read = await reader.next();
    if (read.done) break;
    batches.push(read.value);
  }
  return new Table(reader.schema, batches);
}

function queryError(sql: string, cause: unknown): DataError {
  return new DataError({ operation: "query", detail: sql, cause });
}
