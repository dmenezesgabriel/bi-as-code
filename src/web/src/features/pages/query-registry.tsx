import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Effect, Exit } from "effect";
import { DuckDb } from "../data/data-service";
import { useDataRuntime } from "../data/runtime";
import { interpolateQuery, type InterpolatedQuery } from "./interpolate";
import { runBlock } from "./run-block";
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
 * What a filtered consumer needs to run its own variant of a block: the
 * block's interpolated SQL + params, and the page's table-registration gate
 * (a filtered query waits for the same registration the registry runs on).
 * `registered` is null until the provider's first effect has created it.
 */
export interface QuerySource {
  readonly interpolated: Readonly<Record<string, InterpolatedQuery>>;
  readonly registered: Promise<Exit.Exit<void, unknown>> | null;
}

const QuerySourceContext = createContext<QuerySource>({
  interpolated: {},
  registered: null,
});

/** The page's interpolated blocks + registration gate; the default outside a provider has neither. */
export function useQuerySource(): QuerySource {
  return useContext(QuerySourceContext);
}

/**
 * Page-scoped query registry: on mount it registers `sqlTables` (config ∪
 * page, merged upstream) against the app's DuckDB service, then interpolates
 * every named ` ```sql ` block once (memoized — also exposed through
 * `useQuerySource` for filtered consumers) and runs them through the
 * `DuckDb` port, publishing a `name → QueryResult` map.
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
  const [registered, setRegistered] = useState<Promise<
    Exit.Exit<void, unknown>
  > | null>(null);
  const interpolated = useMemo(() => {
    const queries = Object.fromEntries(
      sqlBlocks.map((block) => [block.name, block.sql]),
    );
    return Object.fromEntries(
      sqlBlocks.map((block) => [
        block.name,
        interpolateQuery(block.sql, { params, queries }, new Set([block.name])),
      ]),
    );
  }, [sqlBlocks, params]);

  useEffect(() => {
    const sig = signatureOf(sqlTables);
    let reg = registration.current;
    if (reg?.sig !== sig) {
      reg = { sig, done: runtime.runPromiseExit(registerAll(sqlTables)) };
      registration.current = reg;
      setRegistered(reg.done);
    }
    const control = new AbortController();
    setResults(initialResults(sqlBlocks));
    for (const [name, query] of Object.entries(interpolated)) {
      void runBlock(runtime, reg.done, query, control.signal).then((result) => {
        if (!control.signal.aborted) {
          setResults((prev) => ({ ...prev, [name]: result }));
        }
      });
    }
    return () => control.abort();
  }, [runtime, sqlBlocks, sqlTables, interpolated]);

  const source = useMemo(
    () => ({ interpolated, registered }),
    [interpolated, registered],
  );
  return (
    <QueryResultsContext.Provider value={results}>
      <QuerySourceContext.Provider value={source}>
        {children}
      </QuerySourceContext.Provider>
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
