import { RecordBatchReader } from "apache-arrow";
import type {
  ConnectionFactory,
  PreparedStatementLike,
  QueryConnection,
  ResultReader,
} from "./run-query";

/** A connection as the engine hands it out, good for reading its id. */
export interface EngineConnectionHandle {
  useUnsafe<R>(read: (bindings: unknown, connection: number) => R): R;
}

/**
 * The requests duckdb-wasm's worker serves, as the blocking bindings answer
 * them in place — the browser's `AsyncDuckDB` posts each one as a message.
 */
export interface EngineRequests {
  connect(): EngineConnectionHandle;
  disconnect(connection: number): void;
  startPendingQuery(
    connection: number,
    sql: string,
    allowStreamResult: boolean,
  ): Uint8Array | null;
  pollPendingQuery(connection: number): Uint8Array | null;
  cancelPendingQuery(connection: number): boolean;
  fetchQueryResults(connection: number): Uint8Array | null;
  createPrepared(connection: number, sql: string): number;
  sendPrepared(
    connection: number,
    statement: number,
    params: unknown[],
  ): Uint8Array;
  closePrepared(connection: number, statement: number): void;
}

/**
 * Told each request when it is posted, as `<connection>:<REQUEST_TYPE>` —
 * connections numbered from 1 in the order their factory opened them, the
 * type spelled as duckdb-wasm's worker protocol spells it.
 */
export type EngineRequestObserver = (request: string) => void;

/** Posts one request for one connection and resolves with its answer. */
type PostRequest = <T>(type: string, answer: () => T) => Promise<T>;

/**
 * The worker's inbox: requests are answered one at a time in posting order,
 * each a task after the previous — so a request posted after a disconnect
 * reaches the engine after it, as it does in the browser.
 */
class WorkerInbox {
  private last: Promise<unknown> = Promise.resolve();

  post<T>(answer: () => T): Promise<T> {
    const answered = this.last.then(nextTask).then(answer);
    this.last = answered.catch(() => undefined);
    return answered;
  }
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * A result stream's chunks, requested as duckdb-wasm's
 * `AsyncResultStreamIterator` requests them: the header first, then one
 * fetch per chunk with the following fetch posted before the consumer asks.
 */
class EngineChunks implements AsyncIterableIterator<Uint8Array> {
  private first = true;
  private depleted = false;
  private prefetched: Promise<Uint8Array | null> | null = null;

  constructor(
    private readonly header: Uint8Array,
    private readonly fetch: () => Promise<Uint8Array | null>,
  ) {}

  async next(): Promise<IteratorResult<Uint8Array>> {
    if (this.first) {
      this.first = false;
      return { done: false, value: this.header };
    }
    if (this.depleted) return { done: true, value: undefined };
    let chunk = await this.prefetched;
    this.prefetched = null;
    while (chunk == null) chunk = await this.fetch();
    this.depleted = chunk.length === 0;
    if (!this.depleted) this.prefetched = this.fetch();
    return { done: this.depleted, value: chunk };
  }

  [Symbol.asyncIterator](): this {
    return this;
  }
}

/**
 * A `ConnectionFactory` over the real engine that behaves like the
 * browser's: requests queue through one inbox and `observe` hears each one
 * as it is posted.
 *
 * @example
 * const factory = engineConnectionFactory(engine, (r) => posted.push(r));
 * await Effect.runPromise(runQuery(factory, "select 1"));
 */
export function engineConnectionFactory(
  engine: EngineRequests,
  observe: EngineRequestObserver,
): ConnectionFactory {
  const inbox = new WorkerInbox();
  let opened = 0;
  return {
    connect: async () => {
      const number = ++opened;
      const id = engine.connect().useUnsafe((_bindings, conn) => conn);
      const post: PostRequest = (type, answer) => {
        observe(`${number}:${type}`);
        return inbox.post(answer);
      };
      return engineConnection(engine, id, post);
    },
  };
}

function engineConnection(
  engine: EngineRequests,
  id: number,
  post: PostRequest,
): QueryConnection {
  return {
    send: (sql) => sendPending(engine, id, post, sql),
    prepare: (sql) => prepareStatement(engine, id, post, sql),
    cancelSent: () =>
      post("CANCEL_PENDING_QUERY", () => engine.cancelPendingQuery(id)),
    close: () => post("DISCONNECT", () => engine.disconnect(id)),
  };
}

async function sendPending(
  engine: EngineRequests,
  id: number,
  post: PostRequest,
  sql: string,
): Promise<ResultReader> {
  let header = await post("START_PENDING_QUERY", () =>
    engine.startPendingQuery(id, sql, false),
  );
  while (header == null) {
    header = await post("POLL_PENDING_QUERY", () =>
      engine.pollPendingQuery(id),
    );
  }
  return streamReader(engine, id, post, header);
}

async function prepareStatement(
  engine: EngineRequests,
  id: number,
  post: PostRequest,
  sql: string,
): Promise<PreparedStatementLike> {
  const statement = await post("CREATE_PREPARED", () =>
    engine.createPrepared(id, sql),
  );
  return {
    send: async (...params) =>
      streamReader(
        engine,
        id,
        post,
        await post("SEND_PREPARED", () =>
          engine.sendPrepared(id, statement, params),
        ),
      ),
    close: () =>
      post("CLOSE_PREPARED", () => engine.closePrepared(id, statement)),
  };
}

function streamReader(
  engine: EngineRequests,
  id: number,
  post: PostRequest,
  header: Uint8Array,
): Promise<ResultReader> {
  const fetch = () =>
    post("FETCH_QUERY_RESULTS", () => engine.fetchQueryResults(id));
  return RecordBatchReader.from(new EngineChunks(header, fetch));
}
