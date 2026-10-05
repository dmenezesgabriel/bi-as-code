import { describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { Effect, Layer } from "effect";
import { tableFromJSON } from "apache-arrow";
import { DuckDb, type DuckDbService } from "./data-service";
import { DataRuntimeProvider, useDataRuntime } from "./runtime";

function fakeDuckDb(): DuckDbService {
  return {
    registerTable: () => Effect.void,
    query: () => Effect.succeed(tableFromJSON([{ n: 7 }])),
    queryRows: () => Effect.succeed([{ n: 7 }]),
  };
}

function Probe({
  onRuntime,
}: {
  onRuntime: (rt: ReturnType<typeof useDataRuntime>) => void;
}) {
  const runtime = useDataRuntime();
  useEffect(() => {
    onRuntime(runtime);
  }, [runtime, onRuntime]);
  return null;
}

describe("DataRuntimeProvider", () => {
  it("builds the layer lazily — mounting alone never touches it", async () => {
    let builds = 0;
    const layer = Layer.effect(
      DuckDb,
      Effect.sync(() => {
        builds += 1;
        return fakeDuckDb();
      }),
    );

    let runtime: ReturnType<typeof useDataRuntime> | null = null;
    render(
      <DataRuntimeProvider layer={layer}>
        <Probe onRuntime={(rt) => (runtime = rt)} />
      </DataRuntimeProvider>,
    );
    await act(async () => {});

    expect(builds).toBe(0);
    const rows = await runtime!.runPromise(
      DuckDb.use((db) => db.queryRows("select 1")),
    );
    expect(builds).toBe(1);
    expect(rows).toEqual([{ n: 7 }]);
  });

  it("disposes the runtime scope on unmount", async () => {
    let released = false;
    const layer = Layer.effect(
      DuckDb,
      Effect.acquireRelease(Effect.sync(fakeDuckDb), () =>
        Effect.sync(() => {
          released = true;
        }),
      ),
    );

    let runtime: ReturnType<typeof useDataRuntime> | null = null;
    const { unmount } = render(
      <DataRuntimeProvider layer={layer}>
        <Probe onRuntime={(rt) => (runtime = rt)} />
      </DataRuntimeProvider>,
    );
    await runtime!.runPromise(DuckDb.use((db) => db.query("select 1")));

    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(released).toBe(true);
  });

  it("rebuilds after the provider remounts (StrictMode double-mount)", async () => {
    let builds = 0;
    const layer = Layer.effect(
      DuckDb,
      Effect.sync(() => {
        builds += 1;
        return fakeDuckDb();
      }),
    );

    const mounted = (
      <DataRuntimeProvider layer={layer}>
        <Probe onRuntime={(rt) => (runtimeRef.current = rt)} />
      </DataRuntimeProvider>
    );
    const runtimeRef: { current: ReturnType<typeof useDataRuntime> | null } = {
      current: null,
    };
    const first = render(mounted);
    await runtimeRef.current!.runPromise(
      DuckDb.use((db) => db.query("select 1")),
    );
    first.unmount();
    const second = render(mounted);
    await runtimeRef.current!.runPromise(
      DuckDb.use((db) => db.query("select 1")),
    );
    second.unmount();

    expect(builds).toBe(2);
  });
});
