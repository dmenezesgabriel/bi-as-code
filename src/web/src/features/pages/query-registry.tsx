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
 * A param change re-runs only the blocks whose interpolated SQL or bound
 * params it changed — a fence that never reads `{{params.*}}` keeps its
 * result and its in-flight query, so a filter input whose bounds read that
 * fence stays enabled through its own changes. Unmount aborts in-flight
 * queries: each stops reading at its next batch (run-query's interrupt
 * handler).
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
  const interpolated = useStableInterpolation(sqlBlocks, params);
  const blockRuns = useRef<BlockRuns | null>(null);

  useEffect(() => {
    const sig = signatureOf(sqlTables);
    if (registration.current?.sig === sig) return;
    const done = runtime.runPromiseExit(registerAll(sqlTables));
    registration.current = { sig, done };
    setRegistered(done);
  }, [runtime, sqlTables]);

  useEffect(() => {
    if (!registered) return;
    const runs = runsFor(blockRuns, registered);
    const stale = staleBlocks(runs, interpolated);
    if (stale.size === 0) return;
    setResults((prev) => withLoading(prev, interpolated, stale));
    for (const name of stale) {
      const query = interpolated[name];
      if (!query) continue;
      const control = startRun(runs, name, query);
      void runBlock(runtime, registered, query, control.signal).then(
        (result) => {
          if (!control.signal.aborted) {
            setResults((prev) => ({ ...prev, [name]: result }));
          }
        },
      );
    }
  }, [runtime, registered, interpolated]);
  useEffect(() => () => abortRuns(blockRuns), []);

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

/**
 * Every block interpolated against `params`, reusing the previous render's
 * `InterpolatedQuery` object for each block whose SQL, params and errors
 * are unchanged — identity is what tells the run effect and filtered
 * consumers (`useFilteredQueryClient`'s connect effect) that a block did
 * not change. Derived state from the previous render, React's sanctioned
 * alternative to reading a ref during render.
 */
function useStableInterpolation(
  sqlBlocks: readonly SqlBlock[],
  params: Readonly<Record<string, unknown>>,
): Readonly<Record<string, InterpolatedQuery>> {
  const fresh = useMemo(
    () => interpolateBlocks(sqlBlocks, params),
    [sqlBlocks, params],
  );
  const [stable, setStable] = useState(() => ({ fresh, queries: fresh }));
  if (stable.fresh === fresh) return stable.queries;
  const queries = reuseUnchanged(stable.queries, fresh);
  setStable({ fresh, queries });
  return queries;
}

function interpolateBlocks(
  sqlBlocks: readonly SqlBlock[],
  params: Readonly<Record<string, unknown>>,
): Record<string, InterpolatedQuery> {
  const queries = Object.fromEntries(
    sqlBlocks.map((block) => [block.name, block.sql]),
  );
  return Object.fromEntries(
    sqlBlocks.map((block) => [
      block.name,
      interpolateQuery(block.sql, { params, queries }, new Set([block.name])),
    ]),
  );
}

function reuseUnchanged(
  previous: Readonly<Record<string, InterpolatedQuery>>,
  next: Readonly<Record<string, InterpolatedQuery>>,
): Record<string, InterpolatedQuery> {
  return Object.fromEntries(
    Object.entries(next).map(([name, query]) => {
      const before = previous[name];
      const same = before && JSON.stringify(before) === JSON.stringify(query);
      return [name, same ? before : query];
    }),
  );
}

/** The query each block last started, keyed by block name, per registration. */
interface BlockRuns {
  readonly registration: Promise<Exit.Exit<void, unknown>>;
  readonly byName: Map<
    string,
    { readonly query: InterpolatedQuery; readonly control: AbortController }
  >;
}

/** The runs made against `registration` — a new registration starts over. */
function runsFor(
  blockRuns: { current: BlockRuns | null },
  registration: Promise<Exit.Exit<void, unknown>>,
): BlockRuns {
  if (blockRuns.current?.registration !== registration) {
    abortRuns(blockRuns);
    blockRuns.current = { registration, byName: new Map() };
  }
  return blockRuns.current;
}

/**
 * Names whose current query differs from the one last started; runs of
 * blocks no longer on the page are aborted and forgotten.
 */
function staleBlocks(
  runs: BlockRuns,
  interpolated: Readonly<Record<string, InterpolatedQuery>>,
): ReadonlySet<string> {
  for (const [name, run] of runs.byName) {
    if (name in interpolated) continue;
    run.control.abort();
    runs.byName.delete(name);
  }
  return new Set(
    Object.keys(interpolated).filter(
      (name) => runs.byName.get(name)?.query !== interpolated[name],
    ),
  );
}

/** Aborts the block's previous run and records `query` as its current one. */
function startRun(
  runs: BlockRuns,
  name: string,
  query: InterpolatedQuery,
): AbortController {
  runs.byName.get(name)?.control.abort();
  const control = new AbortController();
  runs.byName.set(name, { query, control });
  return control;
}

function abortRuns(blockRuns: { current: BlockRuns | null }): void {
  for (const run of blockRuns.current?.byName.values() ?? []) {
    run.control.abort();
  }
  blockRuns.current = null;
}

/** The page's blocks, `stale` ones reset to loading, the rest kept. */
function withLoading(
  prev: Readonly<Record<string, QueryResult>>,
  interpolated: Readonly<Record<string, InterpolatedQuery>>,
  stale: ReadonlySet<string>,
): Record<string, QueryResult> {
  return Object.fromEntries(
    Object.keys(interpolated).map((name) => [
      name,
      stale.has(name) ? LOADING : (prev[name] ?? LOADING),
    ]),
  );
}

const LOADING: QueryResult = { status: "loading" };

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
