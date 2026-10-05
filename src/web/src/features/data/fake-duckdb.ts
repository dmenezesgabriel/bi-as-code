import { Effect } from "effect";
import type { DuckDbService } from "./data-service";
import { DataError, type Row } from "./types";

/**
 * Recording `DuckDb` double for web-unit tests — captures registrations and
 * issued queries so callers assert what the layer would have run; `rows` is
 * the canned result, `registerCause`/`failWhen` inject failures. `query`
 * dies because consumers under test go through `queryRows`.
 */
export class FakeDuckDb implements DuckDbService {
  readonly registered: { name: string; source: string }[] = [];
  readonly queries: { sql: string; params: readonly unknown[] }[] = [];
  rows: Row[] = [{ n: 1 }];
  registerCause: Error | null = null;
  failWhen: ((sql: string) => string | null) | null = null;

  /** A fake whose queries all return `rows`. */
  static withRows(rows: Row[]): FakeDuckDb {
    const db = new FakeDuckDb();
    db.rows = rows;
    return db;
  }

  /** A fake whose queries never resolve — for the loading state. */
  static pending(): FakeDuckDb {
    const db = new FakeDuckDb();
    db.queryRows = () => Effect.promise(() => new Promise<Row[]>(() => {}));
    return db;
  }

  /** A fake whose queries all fail with `message` — for the error state. */
  static failing(message: string): FakeDuckDb {
    const db = new FakeDuckDb();
    db.failWhen = () => message;
    return db;
  }

  registerTable: DuckDbService["registerTable"] = (name, source) => {
    this.registered.push({ name, source });
    return this.registerCause
      ? Effect.fail(
          new DataError({
            operation: "registerTable",
            detail: `${name} ← ${source}`,
            cause: this.registerCause,
          }),
        )
      : Effect.void;
  };

  query: DuckDbService["query"] = () =>
    Effect.die(new Error("FakeDuckDb.query is not implemented"));

  queryRows: DuckDbService["queryRows"] = (sql, params = []) => {
    this.queries.push({ sql, params });
    const failure = this.failWhen?.(sql);
    return failure
      ? Effect.fail(
          new DataError({
            operation: "query",
            detail: sql,
            cause: new Error(failure),
          }),
        )
      : Effect.succeed(this.rows);
  };
}
