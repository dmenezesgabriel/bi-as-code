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
  /**
   * Per-query row override — widgets binding two names seed each by sql;
   * `params` lets a fake answer wrapped queries by their bound values (a
   * crossfilter clause's sql is identical across values).
   */
  rowsWhen: ((sql: string, params: readonly unknown[]) => Row[] | null) | null =
    null;
  /**
   * Per-query hold — a promise returned here delivers that query's rows only
   * when the test resolves it, so a caller's cancel-on-change path can be
   * observed (keyed on params too: a wrapped query's sql is identical across
   * filter values).
   */
  holdWhen:
    | ((sql: string, params: readonly unknown[]) => Promise<Row[]> | null)
    | null = null;

  /** A fake whose queries all return `rows`. */
  static withRows(rows: Row[]): FakeDuckDb {
    const db = new FakeDuckDb();
    db.rows = rows;
    return db;
  }

  /**
   * A fake whose queries return `rows` unless `when(sql)` supplies that
   * query's own rows — the filtered-widget stories' shape: the wrapped
   * query (`… where region = ?`) returns the filtered rows, the plain one
   * the full set.
   *
   * @example
   * FakeDuckDb.withRowsWhen(ALL, (sql) => sql.includes("where region = ?") ? WEST : null);
   */
  static withRowsWhen(
    rows: Row[],
    when: (sql: string) => Row[] | null,
  ): FakeDuckDb {
    const db = new FakeDuckDb();
    db.rows = rows;
    db.rowsWhen = when;
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
    if (failure) {
      return Effect.fail(
        new DataError({
          operation: "query",
          detail: sql,
          cause: new Error(failure),
        }),
      );
    }
    const held = this.holdWhen?.(sql, params);
    return held
      ? Effect.promise(() => held)
      : Effect.succeed(this.rowsWhen?.(sql, params) ?? this.rows);
  };
}
