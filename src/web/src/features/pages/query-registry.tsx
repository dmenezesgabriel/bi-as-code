import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Cause, Effect, Exit } from "effect";
import { DuckDb } from "../data/data-service";
import { useDataRuntime, type DataRuntime } from "../data/runtime";
import { interpolateQuery } from "./interpolate";
import type { QueryResult, SqlBlock, SqlTableMap } from "./types";

/**
 * name → latest `QueryResult`. A name is present from mount (seeded
 * `loading`), so consumers distinguish "a named ` ```sql ` block, still
 * running" from "not a query" by key presence alone. Pages without a
 * provider see the empty default — every block resolves to code-only.
 */
const QueryResultsContext = createContext<
  Readonly<Record<string, QueryResult>>
>({});

/**
 * The registry's read side: fence components look their block's name up in
 * the returned map. Outside a `QueryRegistryProvider` this is `{}`.
 */
export function useQueryResults(): Readonly<Record<string, QueryResult>> {
  return useContext(QueryResultsContext);
}

/**
 * Page-scoped query registry: on mount it registers `sqlTables` (config ∪
 * page, merged upstream) against the app's DuckDB service, then runs every
 * named ` ```sql ` block through `interpolateQuery` + the `DuckDb` port and
 * publishes a `name → QueryResult` map.
 *
 * Registration is signature-gated so a remount with the same source-set
 * (StrictMode, re-render churn) registers once; a genuinely new mount
 * re-registers, which is why registration itself is `CREATE OR REPLACE`.
 * Param changes re-run queries without re-registering; unmount aborts
 * in-flight queries (`cancelSent` via run-query's interrupt handler).
 *
 * @example
 * <QueryRegistryProvider sqlBlocks={page.sqlBlocks} sqlTables={page.sqlTables} params={search}>
 *   <Content components={mdxComponents} />
 * </QueryRegistryProvider>
 */
export function QueryRegistryProvider({
  sqlBlocks,
  sqlTables,
  params,
  children,
}: {
  sqlBlocks: readonly SqlBlock[];
  sqlTables: SqlTableMap;
  params: Readonly<Record<string, unknown>>;
  children: ReactNode;
}) {
  const runtime = useDataRuntime();
  const [results, setResults] = useState<Record<string, QueryResult>>(() =>
    initialResults(sqlBlocks),
  );
  const registration = useRef<{
    sig: string;
    done: Promise<Exit.Exit<void, unknown>>;
  } | null>(null);

  useEffect(() => {
    const sig = signatureOf(sqlTables);
    let reg = registration.current;
    if (reg?.sig !== sig) {
      reg = { sig, done: runtime.runPromiseExit(registerAll(sqlTables)) };
      registration.current = reg;
    }
    const registered = reg.done;
    const queries = Object.fromEntries(
      sqlBlocks.map((block) => [block.name, block.sql]),
    );
    const control = new AbortController();
    setResults(initialResults(sqlBlocks));
    for (const block of sqlBlocks) {
      void runBlock(
        runtime,
        registered,
        block,
        queries,
        params,
        control.signal,
      ).then((result) => {
        if (!control.signal.aborted) {
          setResults((prev) => ({ ...prev, [block.name]: result }));
        }
      });
    }
    return () => control.abort();
  }, [runtime, sqlBlocks, sqlTables, params]);

  return (
    <QueryResultsContext.Provider value={results}>
      {children}
    </QueryResultsContext.Provider>
  );
}

function signatureOf(tables: SqlTableMap): string {
  return JSON.stringify(Object.entries(tables).sort());
}

function initialResults(
  blocks: readonly SqlBlock[],
): Record<string, QueryResult> {
  return Object.fromEntries(
    blocks.map((block) => [block.name, { status: "loading" as const }]),
  );
}

function registerAll(tables: SqlTableMap) {
  return DuckDb.use((db) =>
    Effect.forEach(
      Object.entries(tables),
      ([name, source]) => db.registerTable(name, source),
      { discard: true },
    ),
  );
}

async function runBlock(
  runtime: DataRuntime,
  registered: Promise<Exit.Exit<void, unknown>>,
  block: SqlBlock,
  queries: Record<string, string>,
  params: Readonly<Record<string, unknown>>,
  signal: AbortSignal,
): Promise<QueryResult> {
  const interpolated = interpolateQuery(
    block.sql,
    { params, queries },
    new Set([block.name]),
  );
  if (interpolated.errors.length > 0) {
    return { status: "error", message: interpolated.errors.join("; ") };
  }
  // runBlock must never reject: callers `void` it and a rejection would be
  // unobserved (a disposed runtime mid-unmount throws on await). Every
  // failure becomes an `error` result — or a discarded one when aborted.
  try {
    const reg = await registered;
    if (Exit.isFailure(reg)) {
      return { status: "error", message: errorMessage(reg.cause) };
    }
    if (signal.aborted) return { status: "loading" };
    const exit = await runtime.runPromiseExit(
      DuckDb.use((db) => db.queryRows(interpolated.sql, interpolated.params)),
      { signal },
    );
    if (Exit.isSuccess(exit)) return { status: "success", rows: exit.value };
    return { status: "error", message: errorMessage(exit.cause) };
  } catch (cause) {
    return {
      status: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

function errorMessage(cause: Cause.Cause<unknown>): string {
  const squashed = Cause.squash(cause);
  return squashed instanceof Error ? squashed.message : String(squashed);
}
