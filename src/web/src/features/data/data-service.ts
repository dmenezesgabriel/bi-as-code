import { Context, type Effect } from "effect";
import type { Table } from "apache-arrow";
import type { DataError, Row } from "./types";

/**
 * The data port: everything page SQL needs from the engine. Arrow `Table`
 * stays available for consumers that want batches directly (the future
 * coordinator); `queryRows` is the widget-facing shape.
 */
export interface DuckDbService {
  /** Registers a `sql:` source (`data/…` path) under `name`. */
  readonly registerTable: (
    name: string,
    source: string,
  ) => Effect.Effect<void, DataError>;
  /**
   * Runs `sql` on a fresh connection; positional `?` placeholders bind from
   * `params`. Interrupting the effect cancels the in-flight DuckDB query.
   */
  readonly query: (
    sql: string,
    params?: readonly unknown[],
  ) => Effect.Effect<Table, DataError>;
  /** `query` with rows converted to plain objects. */
  readonly queryRows: (
    sql: string,
    params?: readonly unknown[],
  ) => Effect.Effect<Row[], DataError>;
}

/**
 * `DuckDb` is yielded in `Effect.gen` or called through `DuckDb.use`; the
 * app provides it via `DuckDbLive` (the wasm layer) and tests via
 * `Layer.succeed(DuckDb, fake)`.
 *
 * @example
 * const rows = DuckDb.use((db) => db.queryRows("select * from orders"));
 */
export class DuckDb extends Context.Service<DuckDb, DuckDbService>()(
  "biac/DuckDb",
) {}
