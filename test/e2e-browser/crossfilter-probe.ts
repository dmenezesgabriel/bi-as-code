import type { Page } from "@playwright/test";

/**
 * Cross-filter load probe: records every duckdb-wasm worker request that
 * opens, cancels or closes a query, every chart paint and every filter URL
 * write, so a spec can count publishes, queries per chart and paints per
 * drag without touching application code. Each query runs on its own connection
 * (`runQuery` in `src/web/src/features/data/run-query.ts`), so a query's
 * lifetime is its connection's: first SQL-bearing request → `DISCONNECT`,
 * with `CANCEL_PENDING_QUERY` in between when a newer publish superseded it.
 */

/** One worker request the probe kept, timestamped with `performance.now()`. */
export interface WorkerRequestRecord {
  readonly type: string;
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
  cancelled: number;
  medianMs: number;
  maxMs: number;
}

interface ProbeWindow {
  __xfRequests: WorkerRequestRecord[];
  __xfPaints: ChartPaintRecord[];
  __xfPublishes: number[];
}

/**
 * Installs the probe before any page script runs: wraps
 * `Worker.prototype.postMessage` (keeping the request types that bound a
 * query's lifetime), `history.replaceState` (every filter publish writes
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
      "CANCEL_PENDING_QUERY",
      "DISCONNECT",
    ]);
    const probe = window as unknown as ProbeWindow;
    probe.__xfRequests = [];
    probe.__xfPaints = [];
    probe.__xfPublishes = [];
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
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, ...args: unknown[]) {
      const request = args[0] as { type?: string; data?: unknown } | undefined;
      if (request?.type && kept.has(request.type))
        probe.__xfRequests.push({
          type: request.type,
          data: request.data,
          t: performance.now(),
        });
      return original.apply(this, args as [unknown]);
    };
  });
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
}> {
  return page.evaluate(() => {
    const probe = window as unknown as ProbeWindow;
    return {
      requests: probe.__xfRequests,
      paints: probe.__xfPaints,
      publishes: probe.__xfPublishes,
    };
  });
}

/** In-page: no query open and nothing requested or painted for `quiet` ms. */
function isQuiet(quiet: number): boolean {
  const probe = window as unknown as ProbeWindow;
  const open = new Set<unknown>();
  for (const r of probe.__xfRequests) {
    const conn = Array.isArray(r.data) ? r.data[0] : r.data;
    if (r.type === "DISCONNECT") open.delete(conn);
    else if (r.type !== "CANCEL_PENDING_QUERY") open.add(conn);
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
  cancelled: boolean;
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
 * connection's `DISCONNECT`. Unlabelled queries (the slider's bounds) are
 * skipped; connection ids are reused, so a pair closes on disconnect.
 */
function queryLifetimes(requests: readonly WorkerRequestRecord[]) {
  const open = new Map<unknown, QueryLifetime>();
  const done: QueryLifetime[] = [];
  for (const record of requests) {
    const conn = connectionOf(record);
    const query = open.get(conn);
    if (record.type === "CANCEL_PENDING_QUERY" && query) query.cancelled = true;
    if (record.type === "DISCONNECT" && query) {
      done.push({ ...query, end: record.t });
      open.delete(conn);
    }
    const label = labelOf(record);
    if (label && !query)
      open.set(conn, { label, start: record.t, end: NaN, cancelled: false });
  }
  return done;
}

function median(xs: readonly number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Per-chart query counts and durations for queries that started inside
 * `[from, to]`, keyed by fence label.
 *
 * @example
 * summarizeQueries(requests, ["delay", "distance"], down, settled).delay.issued
 */
export function summarizeQueries(
  requests: readonly WorkerRequestRecord[],
  labels: readonly string[],
  from: number,
  to: number,
): Record<string, ChartQuerySummary> {
  const inWindow = queryLifetimes(requests).filter(
    (q) => q.start >= from && q.start <= to,
  );
  return Object.fromEntries(
    labels.map((label) => {
      const mine = inWindow.filter((q) => q.label === label);
      const durations = mine.map((q) => Math.round(q.end - q.start));
      return [
        label,
        {
          issued: mine.length,
          completed: mine.filter((q) => !q.cancelled).length,
          cancelled: mine.filter((q) => q.cancelled).length,
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
