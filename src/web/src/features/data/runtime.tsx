import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { ManagedRuntime, type Layer } from "effect";
import type { DuckDb } from "./data-service";

type Runtime = ManagedRuntime.ManagedRuntime<DuckDb, unknown>;

/**
 * A `ManagedRuntime` handle that never builds its layer until the first
 * `run*` call — a page with no SQL never downloads the wasm. Implemented as
 * forwarding closures over a lazy accessor so the facade is stable across
 * renders while the underlying runtime can still be rebuilt after disposal.
 */
export interface DataRuntime {
  readonly runPromise: Runtime["runPromise"];
  readonly runPromiseExit: Runtime["runPromiseExit"];
  readonly runFork: Runtime["runFork"];
}

const DataRuntimeContext = createContext<() => Runtime>(() => {
  throw new Error("useDataRuntime used outside DataRuntimeProvider");
});

/**
 * Provides the `ManagedRuntime` that owns the `layer`'s resources for the
 * app's lifetime. Construction is deferred to the first `run*`; unmounting
 * (or a layer swap) disposes the scope, and the next `run*` rebuilds — so
 * StrictMode's mount/unmount/remount cycle is safe.
 */
export function DataRuntimeProvider({
  layer,
  children,
}: {
  layer: Layer.Layer<DuckDb, unknown>;
  children: ReactNode;
}) {
  const runtimeRef = useRef<Runtime | null>(null);
  const getRuntime = useMemo(
    () => () => (runtimeRef.current ??= ManagedRuntime.make(layer)),
    [layer],
  );
  useEffect(
    () => () => {
      void runtimeRef.current?.dispose();
      runtimeRef.current = null;
    },
    [layer],
  );
  return (
    <DataRuntimeContext.Provider value={getRuntime}>
      {children}
    </DataRuntimeContext.Provider>
  );
}

/**
 * The runtime facade for running effects against the data port. The
 * closures throw if no `DataRuntimeProvider` is mounted.
 *
 * @example
 * const runtime = useDataRuntime();
 * useEffect(() => {
 *   const fiber = runtime.runFork(DuckDb.use((db) => db.queryRows(sql)));
 *   return () => void Effect.runPromise(Fiber.interrupt(fiber));
 * }, [runtime, sql]);
 */
export function useDataRuntime(): DataRuntime {
  const getRuntime = useContext(DataRuntimeContext);
  return useMemo(
    () => ({
      runPromise: (effect, options) => getRuntime().runPromise(effect, options),
      runPromiseExit: (effect, options) =>
        getRuntime().runPromiseExit(effect, options),
      runFork: (effect, options) => getRuntime().runFork(effect, options),
    }),
    [getRuntime],
  );
}
