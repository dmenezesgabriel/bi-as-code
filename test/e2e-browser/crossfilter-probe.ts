import type { Page } from "@playwright/test";

/**
 * Cross-filter load probe: records every duckdb-wasm worker request that
 * opens, reads, cancels or closes a query, every chart paint and every
 * filter URL write, so a spec can count publishes, queries per chart and
 * paints per drag without touching application code. Each query runs on its own connection
 * (`runQuery` in `src/web/src/features/data/run-query.ts`), so a query's
 * lifetime is its connection's: first SQL-bearing request → `DISCONNECT`.
 * A query read to its end got an empty `QUERY_RESULT_CHUNK` answer before
 * its disconnect; one abandoned mid-way did not.
 */

/** One worker request the probe kept, timestamped with `performance.now()`. */
export interface WorkerRequestRecord {
  readonly type: string;
  /** The worker answers with this id as the response's `requestId`. */
  readonly messageId: number;
  readonly data: unknown;
  readonly t: number;
}

/**
 * One chart paint — an option applied to a mounted echarts instance —
 * labelled by the `h2` above the chart. A fresh host paints at mount
 * (`mountChart` applies the option before the host exposes the instance);
 * a kept host paints on every later `setOption`. `data-echarts-ready` is no
 * measure of this: it lands on echarts' `finished`, which waits out the
 * entry animation, so results arriving faster than the animation never set it.
 */
export interface ChartPaintRecord {
  readonly chart: string;
  readonly t: number;
}

/** Query lifecycle numbers for one chart over one time window. */
export interface ChartQuerySummary {
  issued: number;
  completed: number;
  abandoned: number;
  medianMs: number;
  maxMs: number;
}

interface ProbeWindow {
  __xfRequests: WorkerRequestRecord[];
  __xfPaints: ChartPaintRecord[];
  __xfPublishes: number[];
  /** `messageId`s of the fetches the worker answered with the empty chunk. */
  __xfStreamEnds: number[];
}

/**
 * Installs the probe before any page script runs: wraps
 * `Worker.prototype.postMessage` (keeping the request types that bound a
 * query's lifetime, and listening on each worker for the empty result
 * chunk that ends a stream), `history.replaceState` (every filter publish writes
 * the URL) and the `echartsInstance` assignment every chart host receives
 * (its mount paint, then each `setOption`). Call before the first
 * `page.goto`.
 *
 * @example
 * await installCrossfilterProbe(page);
 * await page.goto(url);
 */
export async function installCrossfilterProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const kept = new Set([
      "CREATE_PREPARED",
      "START_PENDING_QUERY",
      "POLL_PENDING_QUERY",
      "SEND_PREPARED",
      "FETCH_QUERY_RESULTS",
      "CLOSE_PREPARED",
      "CANCEL_PENDING_QUERY",
      "DISCONNECT",
    ]);
    const probe = window as unknown as ProbeWindow;
    probe.__xfRequests = [];
    probe.__xfPaints = [];
    probe.__xfPublishes = [];
    probe.__xfStreamEnds = [];
    const replaceState = history.replaceState.bind(history);
    history.replaceState = (...args) => {
      probe.__xfPublishes.push(performance.now());
      replaceState(...args);
    };
    const chartOf = (host: Element): string => {
      const headings = [...document.querySelectorAll("h2")].filter(
        (h) =>
          h.compareDocumentPosition(host) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      return headings.at(-1)?.textContent?.trim().toLowerCase() ?? "";
    };
    const paint = (host: Element) =>
      probe.__xfPaints.push({ chart: chartOf(host), t: performance.now() });
    interface ProbedChart {
      setOption(...args: unknown[]): unknown;
    }
    // `delete el.echartsInstance` on dispose misses a prototype accessor,
    // so a disposed host keeps reading its old instance — harmless here:
    // only a theme or renderer flip re-inits, and that assigns afresh.
    const instances = new WeakMap<Element, ProbedChart | undefined>();
    Object.defineProperty(HTMLElement.prototype, "echartsInstance", {
      configurable: true,
      get(this: HTMLElement) {
        return instances.get(this);
      },
      set(this: HTMLElement, chart: ProbedChart | undefined) {
        instances.set(this, chart);
        if (!chart) return;
        paint(this);
        const setOption = chart.setOption.bind(chart);
        chart.setOption = (...args: unknown[]) => {
          paint(this);
          return setOption(...args);
        };
      },
    });
    interface WorkerResponse {
      requestId: number;
      type: string;
      data: unknown;
    }
    const recordStreamEnd = (event: MessageEvent<WorkerResponse>) => {
      const { requestId, type, data } = event.data;
      if (type === "QUERY_RESULT_CHUNK" && (data as Uint8Array)?.length === 0)
        probe.__xfStreamEnds.push(requestId);
    };
    const listened = new WeakSet<Worker>();
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, ...args: unknown[]) {
      if (!listened.has(this)) {
        listened.add(this);
        this.addEventListener("message", recordStreamEnd);
      }
      const request = args[0] as
        | { type?: string; messageId: number; data?: unknown }
        | undefined;
      if (request?.type && kept.has(request.type))
        probe.__xfRequests.push({
          type: request.type,
          messageId: request.messageId,
          data: request.data,
          t: performance.now(),
        });
      return original.apply(this, args as [unknown]);
    };
  });
}

/** Resolves once the probe has recorded a worker request of `type`. */
export async function waitForWorkerRequest(
  page: Page,
  type: string,
): Promise<void> {
  await page.waitForFunction(
    (wanted) =>
      (window as unknown as ProbeWindow).__xfRequests.some(
        (r) => r.type === wanted,
      ),
    type,
    { timeout: 30_000 },
  );
}

/** The page's `performance.now()` — gesture marks share the probe's clock. */
export function pageNow(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

/** Everything the probe recorded so far. */
export function readProbe(page: Page): Promise<{
  requests: WorkerRequestRecord[];
  paints: ChartPaintRecord[];
  publishes: number[];
  streamEnds: number[];
}> {
  return page.evaluate(() => {
    const probe = window as unknown as ProbeWindow;
    return {
      requests: probe.__xfRequests,
      paints: probe.__xfPaints,
      publishes: probe.__xfPublishes,
      streamEnds: probe.__xfStreamEnds,
    };
  });
}

/** In-page: no query open and nothing requested or painted for `quiet` ms. */
function isQuiet(quiet: number): boolean {
  const probe = window as unknown as ProbeWindow;
  const opening = ["CREATE_PREPARED", "START_PENDING_QUERY"];
  const open = new Set<unknown>();
  for (const r of probe.__xfRequests) {
    const conn = Array.isArray(r.data) ? r.data[0] : r.data;
    if (r.type === "DISCONNECT") open.delete(conn);
    else if (opening.includes(r.type)) open.add(conn);
  }
  const last = Math.max(
    0,
    ...probe.__xfRequests.map((r) => r.t),
    ...probe.__xfPaints.map((p) => p.t),
  );
  return open.size === 0 && performance.now() - last > quiet;
}

/** Requests plus paints recorded so far — any growth is fresh activity. */
function activityCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const probe = window as unknown as ProbeWindow;
    return probe.__xfRequests.length + probe.__xfPaints.length;
  });
}

/**
 * Resolves once no query is open and no chart has painted for `quietMs`,
 * and that still holds a macrotask later — the point a gesture has
 * settled. The re-check exists because a selection delivers its queued
 * publish only after the in-flight queries settle, and that delivery's
 * first worker request can land a task later: a main-thread stall longer
 * than `quietMs` just before it would otherwise read as settled.
 *
 * @example
 * await waitForSettled(page);
 */
export async function waitForSettled(page: Page, quietMs = 750): Promise<void> {
  for (;;) {
    await page.waitForFunction(isQuiet, quietMs, { timeout: 60_000 });
    const before = await activityCount(page);
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );
    if ((await activityCount(page)) === before) return;
  }
}

interface QueryLifetime {
  label: string;
  start: number;
  end: number;
  readToEnd: boolean;
}

const FENCE_LABEL = /--\s*(\w+) histogram/;

/** The request's connection id — a bare number or the tuple's head. */
function connectionOf(record: WorkerRequestRecord): unknown {
  return Array.isArray(record.data) ? record.data[0] : record.data;
}

/** The fence label in a SQL-bearing request (`-- delay histogram` → `delay`). */
function labelOf(record: WorkerRequestRecord): string | undefined {
  if (!Array.isArray(record.data)) return undefined;
  const sql: unknown = record.data[1];
  return typeof sql === "string" ? FENCE_LABEL.exec(sql)?.[1] : undefined;
}

/**
 * Pairs each labelled query's first SQL-bearing request with its
 * connection's `DISCONNECT`, noting whether a fetch in between was answered
 * with the stream's end. Unlabelled queries (the slider's bounds) are
 * skipped; connection ids are reused, so a pair closes on disconnect.
 */
function queryLifetimes(
  requests: readonly WorkerRequestRecord[],
  streamEnds: readonly number[],
) {
  const ends = new Set(streamEnds);
  const open = new Map<unknown, QueryLifetime>();
  const done: QueryLifetime[] = [];
  for (const record of requests) {
    const conn = connectionOf(record);
    const query = open.get(conn);
    if (query && ends.has(record.messageId)) query.readToEnd = true;
    if (record.type === "DISCONNECT" && query) {
      done.push({ ...query, end: record.t });
      open.delete(conn);
    }
    const label = labelOf(record);
    if (label && !query)
      open.set(conn, { label, start: record.t, end: NaN, readToEnd: false });
  }
  return done;
}

// A connection's first request: the one that carries its SQL.
const OPENING_REQUESTS = new Set(["CREATE_PREPARED", "START_PENDING_QUERY"]);

/**
 * The requests posted for a connection after its `DISCONNECT`. duckdb-wasm
 * frees a connection on disconnect and checks no handle afterwards, so each
 * of these runs on freed memory. Connection ids are reused: a connection is
 * live again from its next opening request.
 *
 * @example
 * expect(requestsAfterDisconnect((await readProbe(page)).requests)).toEqual([]);
 */
export function requestsAfterDisconnect(
  requests: readonly WorkerRequestRecord[],
): WorkerRequestRecord[] {
  const disconnected = new Set<unknown>();
  return requests.filter((record) => {
    const conn = connectionOf(record);
    if (OPENING_REQUESTS.has(record.type)) disconnected.delete(conn);
    else if (record.type === "DISCONNECT") disconnected.add(conn);
    else return disconnected.has(conn);
    return false;
  });
}

/**
 * How many queries closed their connection before the worker answered a
 * fetch with the stream's end — labelled or not, prepared or plain.
 *
 * @example
 * expect(abandonedQueries(await readProbe(page))).toBeGreaterThan(0);
 */
export function abandonedQueries(probe: {
  requests: readonly WorkerRequestRecord[];
  streamEnds: readonly number[];
}): number {
  const ends = new Set(probe.streamEnds);
  const reading = new Map<unknown, boolean>();
  let abandoned = 0;
  for (const record of probe.requests) {
    const conn = connectionOf(record);
    if (OPENING_REQUESTS.has(record.type)) reading.set(conn, false);
    if (ends.has(record.messageId)) reading.set(conn, true);
    if (record.type !== "DISCONNECT") continue;
    if (reading.get(conn) === false) abandoned++;
    reading.delete(conn);
  }
  return abandoned;
}

function median(xs: readonly number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Per-chart query counts and durations for queries that started inside
 * `[from, to]`, keyed by fence label. A query is abandoned when its
 * connection closed before the worker answered a fetch with the stream's end.
 *
 * @example
 * const { requests, streamEnds } = await readProbe(page);
 * summarizeQueries({ requests, streamEnds }, ["delay"], down, settled).delay.issued
 */
export function summarizeQueries(
  probe: {
    requests: readonly WorkerRequestRecord[];
    streamEnds: readonly number[];
  },
  labels: readonly string[],
  from: number,
  to: number,
): Record<string, ChartQuerySummary> {
  const lifetimes = queryLifetimes(probe.requests, probe.streamEnds);
  const inWindow = lifetimes.filter((q) => q.start >= from && q.start <= to);
  return Object.fromEntries(
    labels.map((label) => {
      const mine = inWindow.filter((q) => q.label === label);
      const durations = mine.map((q) => Math.round(q.end - q.start));
      return [
        label,
        {
          issued: mine.length,
          completed: mine.filter((q) => q.readToEnd).length,
          abandoned: mine.filter((q) => !q.readToEnd).length,
          medianMs: median(durations),
          maxMs: Math.max(0, ...durations),
        },
      ];
    }),
  );
}

/** Paints per chart label inside `[from, to]`. */
export function countPaints(
  paints: readonly ChartPaintRecord[],
  labels: readonly string[],
  from: number,
  to: number,
): Record<string, number> {
  return Object.fromEntries(
    labels.map((label) => [
      label,
      paints.filter((p) => p.chart === label && p.t >= from && p.t <= to)
        .length,
    ]),
  );
}
