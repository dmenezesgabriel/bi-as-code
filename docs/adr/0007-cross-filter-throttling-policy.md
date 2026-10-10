# ADR-0007 — Throttle cross-filter re-queries latest-wins per selection, and spend the main thread only on what a chart draws

Status: accepted
Date: 2026-10-09

## Context

A cross-filter publish re-queries every client in the selection's group ([ADR-0004](0004-cross-filter-is-ported-from-the-mosaic-architecture.md)). A slider drag or a chart brush publishes continuously — one publish per slider tick, one per 150 ms echarts brush throttle (`src/web/src/features/widgets/charts/use-brush-select.ts`) — so on a large table publishes arrive faster than the group can re-query. Queries run client-side in duckdb-wasm ([ADR-0005](0005-queries-run-client-side-in-duckdb-wasm.md)): the database works in a Web Worker, but every result is decoded, converted and drawn on the main thread.

The first cut aborted a client's in-flight query on every publish (`AbortController` per client, `cancelSent()` in `src/web/src/features/data/run-query.ts`). Measured on `pages/crossfilter-scale.md` (200,000 rows over `data/flights.parquet`, three cross-filtered histograms and a slider) with `test/e2e-browser/crossfilter-scale.spec.ts` — a 60-step slider drag, one step every two animation frames:

| Policy                    | Queries issued per chart | Cancelled per chart | Charts painted during the drag |
| ------------------------- | ------------------------ | ------------------- | ------------------------------ |
| Abort on every publish    | 60                       | 39–59               | 0 / 0 / 0                      |
| Latest-wins per selection | 20–25                    | 0                   | 3–7 / 1–2 / 0                  |

Abort is correct but shows nothing: each query outlasts the gap to the next publish, so every one is cancelled before it paints and the charts sit on loading faces until release. Latest-wins paints, but the same drag took 23.7–33.1 s against 7.2–10.3 s under abort, because the spec paces by animation frames and the frames got long.

A main-thread CPU profile of that drag explains the long frames (Chrome DevTools Protocol `Profiler`, 200 µs sampling, three runs, 2026-10-09):

| Main-thread self time during a 24.5–26.8 s slider window      | ms                                                 |
| ------------------------------------------------------------- | -------------------------------------------------- |
| apache-arrow row materialization (`toArray`, `toJSON`, `get`) | 11,781–12,319                                      |
| `toRows` (`src/web/src/features/data/to-rows.ts`)             | ≤ 3,426                                            |
| Garbage collection                                            | 3,162–3,661                                        |
| echarts / zrender drawing                                     | ~550–790                                           |
| `toHistogram` binning (`to-histogram.ts`)                     | 250–304                                            |
| duckdb-wasm client plus worker `postMessage`                  | 212–334                                            |
| Long tasks (> 50 ms)                                          | 131–140, totalling 19.6–21.2 s, longest 353–431 ms |

Each histogram's fence selects the raw columns (`select delay, distance, time from flights`), so every re-query sends up to 200,000 rows to the main thread. They become plain objects one row at a time, and the chart then bins them into about 30 bars. Result polling looks heavy but costs almost nothing. duckdb-wasm's `AsyncResultStreamIterator` (`@duckdb/duckdb-wasm` 1.32.0, `dist/duckdb-browser.mjs`) loops `FETCH_QUERY_RESULTS` until a chunk is ready, about 99 round trips per query, yet the whole duckdb client stays near 1% of the window. Drawing is under 3%.

Mosaic, the architecture ADR-0004 ports, has a query cache, consolidation and preaggregation on by default (https://idl.uw.edu/mosaic/api/core/coordinator.html: `cache`, `consolidate`, `preagg.enabled`, each default `true`). ADR-0004 deferred all three until measured.

## Decision drivers

- A drag paints progressive results, not only the released one — the cross-filter UX the architecture exists for.
- Never paint a result older than one already painted, and always settle on the released clause.
- Main-thread time is the scarce resource: the worker can be busy, but the page must keep responding.
- An idle publish stays synchronous — URL-seeded first paint and every synchronous-publish test depend on it.
- Port a proven mechanism over inventing one; add no mechanism the measurements do not call for.

## Options considered

| Option                                                                 | Pro                                                                                        | Con                                                                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Abort the superseded query on every publish                            | Worker never runs stale work                                                               | Measured: nothing paints during a drag once one query outlasts the publish interval                                                           |
| Latest-wins per selection (one delivery in flight, queue keeps latest) | Every completed result paints; the group settles together; idle publishes stay synchronous | One stale query may run to completion                                                                                                         |
| A time debounce (fixed ms) on the selection path                       | Fewer queries                                                                              | Adds fixed lag to every interaction; the queue already collapses a burst                                                                      |
| Commit on release (slider publishes only on pointer-up)                | One query per gesture                                                                      | No live feedback during the drag                                                                                                              |
| Query consolidation, result cache, preaggregation now                  | Fewer and cheaper worker queries                                                           | None reduces the measured cost: rows reaching the main thread. Each drag extent is a new cache key; consolidation merges queries but not rows |
| Return only what the chart draws (aggregate in SQL)                    | Removes the dominant cost: ~30 rows per histogram instead of up to 200,000                 | A widget composes an aggregate over its fence's filtered rows; the bin domain (filtered or full extent) must be chosen                        |

## Decision

Cross-filter re-queries are serialized **latest-wins per selection**, and a cross-filtered client returns **only the rows it draws**.

- **One delivery in flight per selection.** `Selection` dispatches through `src/web/src/features/crossfilter/async-dispatch.ts`. The `Coordinator` returns the group's `Promise.allSettled` from its subscription (`src/web/src/features/crossfilter/coordinator.ts`), so a selection holds its next delivery until every client in the group settles. The group's charts move together, and a fast chart never runs ahead of a slow one.
- **Queued updates keep only the latest.** Under `cross`, a new update drops queued updates from its own source only, so another widget's clause queued behind a drag survives. Otherwise it drops every queued update (`Selection.#emit` in `src/web/src/features/crossfilter/selection.ts`). Readers resolve against the delivered snapshot, not the queued one.
- **No clock on the selection path.** No rAF, no fixed-ms debounce: the queue already collapses a burst, and an idle publish delivers synchronously. Widget-level pacing stays at the widget (echarts brush 150 ms throttle, text input 300 ms commit).
- **Abort only where paths overlap.** The per-client `AbortController` and `cancelSent()` remain for a re-query that overlaps another path (connect, a direct `requestQuery`, a second selection) and for disconnect. A selection never aborts its own re-queries.
- **The loading face stays** while a client's re-query is pending (`queryPending` → `ChartResult` loading face).
- **Main-thread budget.** A client's re-query result is sized to what it draws. A chart that summarizes rows (a histogram's bins, an aggregate) computes the summary in SQL over its filtered fence, not over rows copied to the main thread. Mosaic does the same: its marks query binned aggregates, not raw rows.
- **Consolidation, result cache and preaggregation stay deferred.** The measured cost is main-thread row materialization, which none of them reduces. Revisit them when a profile with aggregated results shows worker-side query time as the dominant cost.
- **Result polling stays as duckdb-wasm ships it.** About 99 `FETCH_QUERY_RESULTS` round trips per query measured at about 1% of main-thread time. `send()` is kept because only sent queries answer `cancelSent()`.

## Consequences

A drag over a large table paints progressively and settles on the released clause, with no cancelled work wasted. The one stale query per client that latest-wins may finish is accepted, because the alternative paints nothing.

Until histograms aggregate in SQL, a 200,000-row cross-filter page keeps the main thread busy for most of a drag. The fix is in the widget's query shape, not in the dispatch policy, and it adds a choice this ADR does not make: whether bins follow the filtered extent or keep the column's full extent.

What a future reader will be tempted to "fix":

- Adding a debounce or rAF clock to `Selection`. It would make idle publishes asynchronous and add lag the queue already makes unnecessary.
- Restoring abort-on-publish "to save the worker". Measured, it paints nothing during a drag.
- Turning on a result cache or consolidation to make a drag faster. The time is spent turning rows into objects on the main thread, not in the worker. Measure first: the profile method above (CDP `Profiler` around `crossfilter-scale.spec.ts`'s gestures, self time bucketed by script URL) reproduces the numbers.
