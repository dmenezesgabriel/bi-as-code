import { AsyncDuckDB, selectBundle, VoidLogger } from "@duckdb/duckdb-wasm";
import { Effect, Layer } from "effect";
import { duckDbBundles } from "./bundles";
import { DuckDb, type DuckDbService } from "./data-service";
import { registerSource } from "./register-source";
import { runQuery } from "./run-query";
import { toRows } from "./to-rows";
import { DataError } from "./types";

/**
 * selectBundle → worker → instantiate → open. `castTimestampToDate` and
 * `castBigIntToDouble` keep timestamps/ints in JS-native types for widgets.
 * Not unit-tested: jsdom has no Worker/wasm — the e2e-browser spec owns it.
 */
const acquireDuckDb = Effect.acquireRelease(
  Effect.tryPromise({
    try: async () => {
      const bundle = await selectBundle(duckDbBundles);
      if (!bundle.mainWorker) {
        throw new Error("selected duckdb-wasm bundle has no worker script");
      }
      const db = new AsyncDuckDB(
        new VoidLogger(),
        new Worker(bundle.mainWorker),
      );
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      await db.open({
        query: { castTimestampToDate: true, castBigIntToDouble: true },
      });
      return db;
    },
    catch: (cause) =>
      new DataError({
        operation: "instantiate",
        detail: "duckdb-wasm bootstrap",
        cause,
      }),
  }),
  (db) => Effect.promise(() => db.terminate()),
);

/**
 * The live `DuckDb` layer: one lazily-acquired `AsyncDuckDB` whose worker
 * dies when the layer's scope closes (`ManagedRuntime.dispose`). The layer
 * is thin glue — the query path lives in `run-query.ts` and source dispatch
 * in `register-source.ts`, both unit-tested without wasm.
 */
export const DuckDbLive: Layer.Layer<DuckDb, DataError> = Layer.effect(
  DuckDb,
  Effect.map(acquireDuckDb, serviceOf),
);

function serviceOf(db: AsyncDuckDB): DuckDbService {
  return {
    registerTable: (name, source) => registerTableEffect(db, name, source),
    query: (sql, params = []) => runQuery(db, sql, params),
    queryRows: (sql, params = []) =>
      Effect.map(runQuery(db, sql, params), toRows),
  };
}

function registerTableEffect(
  db: AsyncDuckDB,
  name: string,
  source: string,
): Effect.Effect<void, DataError> {
  const fail = (cause: unknown) =>
    new DataError({
      operation: "registerTable",
      detail: `${name} ← ${source}`,
      cause,
    });
  return Effect.gen(function* () {
    const connection = yield* Effect.acquireRelease(
      Effect.tryPromise({ try: () => db.connect(), catch: fail }),
      (conn) => Effect.promise(() => conn.close()),
    );
    yield* Effect.tryPromise({
      try: () => registerSource(db, connection, name, source),
      catch: fail,
    });
  }).pipe(Effect.scoped);
}
