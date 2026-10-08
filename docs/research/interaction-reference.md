# Interaction reference — mosaic cross-filter semantics

**Ephemeral.** Phase-scoped research, sibling of [`feature-census.md`](feature-census.md): the measured semantics of mosaic's cross-filter architecture, recorded so SL-013 (Coordinator + Selection port), SL-014 (chart-driven selections) and SL-015 (perf parity) never guess. Deleted when Phase 1 closes; anything durable becomes an ADR first. This file records semantics and names decisions — it makes none.

## How this was built

- One pass over `research_repos/mosaic/packages/mosaic/core/src/`, mosaic-core `0.32.0` (`grep -m1 '"version"' research_repos/mosaic/packages/mosaic/core/package.json`), 2026-10-08.
- Every cited path verified with `test -e` in-session; line counts from `wc -l`; every number carries its command.
- Behavior evidence: mosaic's own vitest suites in `research_repos/mosaic/packages/mosaic/core/test/` — read, not run (`research_repos/` is read-only and never installed).
- External claims fetched in-session: [Mosaic Core guide](https://idl.uw.edu/mosaic/core/) and [Selection API reference](https://idl.uw.edu/mosaic/api/core/selection.html) (idl.uw.edu/mosaic). Where guide and code disagree, the code in this clone is the source of truth for the port.

## Architecture flow

The publish → re-query path, one row per hop. All paths under `research_repos/mosaic/packages/mosaic/core/src/`.

| #   | Hop                            | Where                           | Fact                                                                                                                                                                               |
| --- | ------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Interaction publishes a clause | `Selection.ts` 197-204          | `selection.update(clause)` resolves the clause list, marks it `active`, relays to downstream selections, then emits `value`                                                        |
| 2   | Resolve                        | `Selection.ts` 317-328          | Clauses from the same `source` are replaced; a null-predicate clause (`clauseNone`) clears its source instead of adding; `single` drops all other clauses and resets their sources |
| 3   | Relay downstream               | `Selection.ts` 97-107, 202      | Selections created with `include: [upstream]` receive every clause and activation published upstream, then apply their own resolution strategy                                     |
| 4   | Async event dispatch           | `util/AsyncDispatch.ts` 122-143 | While a listener's promise is unsettled, new values queue; on enqueue, `emitQueueFilter` may prune queued values                                                                   |
| 5   | Cross queue coalescing         | `Selection.ts` 248-255, 382-390 | Cross-filtered selections drop queued updates whose active clause has the same source — only the newest per source is serviced                                                     |
| 6   | Coordinator filter group       | `Coordinator.ts` 297-324        | One `filterGroups` entry per Selection holds every client whose `filterBy` is that selection; `value` → `updateSelection`, `activate` → `activateSelection`                        |
| 7   | Per-client update              | `Coordinator.ts` 355-395        | Disabled client → defer via `client.requestQuery()`; initializing client → await `client.pending`; else preagg fast path, falling through to the standard query on `QueryError`    |
| 8   | Standard query                 | `Coordinator.ts` 390-393        | `client.query(selection.predicate(client))` — `predicate()` returning `undefined` (cross-skip) skips the client entirely                                                           |
| 9   | Query lifecycle                | `Coordinator.ts` 215-232        | `queryPending()` → `query()` (cache default `true`, priority `Normal`) → `queryResult(data).update()`, or `queryError(QueryError)`                                                 |
| 10  | Activation preview             | `Coordinator.ts` 334-346        | `activate` events (cursor enters brushable region) request preaggregation for enabled clients — a prefetch optimization, not a filter                                              |

## Selection resolution strategies

`Selection extends Param` (`Selection.ts` 44); a `Param` is an `AsyncDispatch` holding one value (`Param.ts` 17, 72-80 — no-op updates are cancelled via `distinct()`). Strategies live in `SelectionResolver` (`Selection.ts` 287-391). Flags per strategy: `cross` (default `false`), `empty` (default `false`), `include` (default `[]`) — [Selection API](https://idl.uw.edu/mosaic/api/core/selection.html).

| Constructor                         | Strategy                  | Resolution                                                                          | Where                                                              |
| ----------------------------------- | ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Selection.intersect()`             | conjunction               | All clauses AND-ed (an array of predicates is implicitly conjunctive in mosaic-sql) | `Selection.ts` 55-57, 373                                          |
| `Selection.union()`                 | disjunction               | All clauses OR-ed via `or()` when more than one                                     | `Selection.ts` 65-67, 373                                          |
| `Selection.single()`                | most-recent               | Only the newest clause is kept; dropped clauses' sources get `reset()`              | `Selection.ts` 75-77, 324-325                                      |
| `Selection.crossfilter()`           | intersect + `cross: true` | Convenience shorthand for `Selection.intersect({ cross: true })`                    | `Selection.ts` 85-87                                               |
| `Selection.single({ cross: true })` | most-recent + cross       | Any strategy combines with `cross`                                                  | [Selection API](https://idl.uw.edu/mosaic/api/core/selection.html) |

| Behavior                     | Where                       | Fact                                                                                                                                  |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Replace-by-source            | `Selection.ts` 322-323      | `resolve()` filters out clauses whose `source` equals the incoming clause's — one clause per source                                   |
| Null predicate clears        | `Selection.ts` 326          | A clause with `predicate: null` is not pushed — it removes its source's clause (pinned by `test/selection.test.ts` 17-27)             |
| `active` clause              | `Selection.ts` 159-161, 201 | The most recently updated clause, tracked on the clause array itself                                                                  |
| `valueFor(source)`           | `Selection.ts` 177-179      | The value of the clause from that source, `undefined` if absent                                                                       |
| `remove(source)`             | `Selection.ts` 125-133      | Clone without that source's clause; `active` becomes a `{ source }` sentinel                                                          |
| `reset(clauses?)`            | `Selection.ts` 214-220      | Removes clauses (default: all), calls `source.reset?.()` on each, relays downstream (pinned by `test/selection.test.ts` 29-52, 54-75) |
| `predicate(client, noSkip?)` | `Selection.ts` 277-281      | Client-specific predicate; `noSkip: true` disables the cross-skip for the active clause                                               |
| `skip(client, clause)`       | `Selection.ts` 337-342      | `cross && clause.clients?.has(client)` — the clause's own clients are not filtered by it                                              |

## Clause types

Clause shape (`clause/SelectionClause.ts` 22-57): `source` (unique by object identity), `clients?` (`Set<MosaicClient>` skipped when cross-filtering), `fields` (`ExprNode[]` — predicate field references are strictly equal to these), `value`, `predicate` (`ExprNode | null`), `meta?` (optimization hints). All constructors under `research_repos/mosaic/packages/mosaic/core/src/clause/`.

| Constructor                           | File                               | Predicate SQL                                                                                                    | Value shape       | Cleared when                                                                        |
| ------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| `clauseNone(source)`                  | `clause/SelectionClause.ts` 65-69  | `null`                                                                                                           | `null`            | always — its only job is clearing                                                   |
| `clausePoint(field, value)`           | `clause/PointClause.ts` 42-61      | `isInDistinct(field, [literal(value)])`                                                                          | scalar            | `value === undefined`                                                               |
| `clausePoints(fields, value[][])`     | `clause/PointClause.ts` 75-101     | 1 field: `isInDistinct(field, values)`; N fields: `or(and(isNotDistinct(f_i, v_i)))` per row                     | array of arrays   | `value == null`; empty array → `literal(false)` (89)                                |
| `clauseInterval(field, [lo, hi])`     | `clause/IntervalClause.ts` 76-96   | `isBetween(field, value)`                                                                                        | `[lo, hi]` extent | `value == null`                                                                     |
| `clauseIntervals(fields, extents[])`  | `clause/IntervalClause.ts` 113-142 | `and(isBetween(f_i, value_i))`                                                                                   | array of extents  | `value == null`                                                                     |
| `clauseList(field, value, listMatch)` | `clause/ListClause.ts` 50-76       | `listHasAny` / `listHasAll` (`listMatch: 'any' \| 'all'`, default `'any'`)                                       | scalar or array   | `undefined` or empty array (62-66, pinned by `test/selection-clause.test.ts` 40-44) |
| `clauseMatch(field, value, opts)`     | `clause/MatchClause.ts` 59-75      | `contains`/`prefix`/`suffix`/`regexp_matches` over `lower(field)` vs `lower(literal)` (case-insensitive default) | string            | falsy `value`                                                                       |
| `clauseMatchAny(fields, value, opts)` | `clause/MatchClause.ts` 90-117     | `or()` of per-field match                                                                                        | string            | falsy `value`                                                                       |

| Clause fact            | Where                                                                                | Fact                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default `clients`      | `clause/PointClause.ts` 46, `clause/IntervalClause.ts` 81, `clause/ListClause.ts` 55 | When `source` is itself a MosaicClient, `clients` defaults to `new Set([source])` — the publishing client excludes itself under cross-filtering; `clauseMatch` defaults to `undefined` (no self-exclusion) |
| Interval metadata      | `clause/IntervalClause.ts` 14-32                                                     | `pixelSize` (default `1`), `scales` (data→pixel mapping), `bin` (`'floor' \| 'ceil' \| 'round'`, default `'floor'`) — hints for preagg binning, not filtering                                              |
| List values are quoted | `test/selection-clause.test.ts` 9-23                                                 | List values containing spaces are quoted as literals, not identifiers; multiple values supported                                                                                                           |

## Cross and empty semantics

| Semantic                 | Where                                                                                            | Fact                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `cross: true`            | `Selection.ts` 7-8, 337-342                                                                      | Clauses are not applied to the clients they are associated with — the interacting view does not filter itself                        |
| Skip in `predicate()`    | `Selection.ts` 363-369                                                                           | The active clause's client is skipped first (returns `undefined` → no query at all), then per-clause `clients` sets are filtered out |
| `empty: false` (default) | `Selection.ts` 9-10, 359-361; [Selection API](https://idl.uw.edu/mosaic/api/core/selection.html) | No clauses → no predicate → all records                                                                                              |
| `empty: true`            | `Selection.ts` 359-361                                                                           | No clauses → `[literal(false)]` → no records; sets the default selection state                                                       |
| `include` relay          | `Selection.ts` 97-107, 185-189, 202, 218                                                         | Upstream clauses, activations and resets relay to every downstream selection; each still applies its own strategy                    |

## Scheduling and debounce

| Mechanism                 | Where                                   | Fact                                                                                                                                                           |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Throttle                  | `util/throttle.ts` 17-58                | While a call's promise is in flight, later calls collapse to the most recent one (`next`), serviced when it settles                                            |
| rAF debounce              | `util/throttle.ts` 47-56                | `debounce: true` defers invocation to the next animation frame — bursts within one frame issue one query                                                       |
| Client wiring             | `MosaicClient.ts` 50, 206-212           | `_requestUpdate = throttle(() => this.requestQuery(), true)`; `requestQuery()` is unthrottled, `requestUpdate()` is the throttled entry point                  |
| Query priorities          | `QueryManager.ts` 11, 28                | `Priority = { High: 0, Normal: 1, Low: 2 }`, a 3-level `PriorityQueue`; `prefetch()` runs at `Low` (`Coordinator.ts` 202)                                      |
| Concurrency cap           | `QueryManager.ts` 27, 41                | `maxConcurrentRequests = 32` pending results before `next()` stops draining the queue (`grep -n "maxConcurrentRequests" QueryManager.ts`)                      |
| exec serialization        | `QueryManager.ts` 41, 51, 63            | No other query runs while an `exec`-type query is pending (`pendingExec` flag, pinned by `test/query-manager.test.ts` 38-64)                                   |
| Query cache               | `QueryManager.ts` 88-96, 108, 112       | SQL → decoded Arrow table, LRU by byte length; in-flight dedup via `inflight` map; rejected queries not cached (`test/query-manager.test.ts` 97-117)           |
| Coordinator defaults      | `Coordinator.ts` 79-87                  | `cache: true`, `consolidate: true` on by default                                                                                                               |
| Consolidation window      | `QueryConsolidator.ts` 21-29, 58-68     | Arrow queries arriving within one frame (rAF; `setImmediate`/`setTimeout` fallback) are bundled                                                                |
| Consolidation key         | `QueryConsolidator.ts` 104-161          | Query stripped to `SELECT *` with sorted groupby expressions; bails on `where`/`qualify`/`having`/`orderby`/`distinct` or cache hits — those consolidate never |
| Consolidated result       | `QueryConsolidator.ts` 213-254, 261-295 | Shared select fields aliased `col0..colN`; each client's result projected back by column map; errors propagate to the whole group                              |
| What consolidates (tests) | `test/query-consolidator.test.ts` 23-88 | Grouped/ungrouped aggregates, differing groupby orders, positional refs; NOT mixed aggregate+non-aggregate (89-98) nor `select distinct` (99-111)              |

## Ours today vs mosaic

Ours: `src/web/src/features/filters/` — `filter.ts` (named filter: value model, URL persistence via `FilterUrlPort`, predicate → `{ sql, params }` WHERE fragment), `filters.ts` (registry, `ensure`), `page-filters-context.tsx` (page-scoped instance), `use-filtered-query-rows.ts` (data-widget read side). Mosaic paths under `research_repos/mosaic/packages/mosaic/core/src/`.

| Concern                                                                | mosaic                                          | Ours                                                                                           | State                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Clause object (`source`/`clients`/`fields`/`value`/`predicate`/`meta`) | `clause/SelectionClause.ts` 22-57               | `filter.ts` 15-18 — `FilterPredicate { sql, params }` only; no source, clients, fields or meta | absent                                                          |
| Replace-by-source clause updates                                       | `Selection.ts` 317-328                          | `filter.ts` 97-106 — one value per filter id, whole-value replacement                          | absent (value model, not clause model)                          |
| Resolution strategies (intersect/union/single)                         | `Selection.ts` 287-391                          | `use-filtered-query-rows.ts` 34-36 — declared filters always AND-ed                            | absent                                                          |
| Cross-filtering (exclude publishing client)                            | `Selection.ts` 337-342, 363-369                 | Inputs never re-query their own data; no per-clause client exclusion exists                    | absent                                                          |
| Empty selection (no clauses → nothing)                                 | `Selection.ts` 359-361                          | `filter.ts` 178 — undefined value → no predicate → all records                                 | absent                                                          |
| Coordinator (central query broker)                                     | `Coordinator.ts` 47-289                         | `page-filters-context.tsx` broadcasts state; each widget re-queries independently              | partial — broadcast without queue, priorities, cancel or preagg |
| Client contract (`query`/`queryPending`/`queryResult`/`queryError`)    | `MosaicClient.ts` 144-173                       | `use-filtered-query-rows.ts` 101-115 — hook-local loading/error state                          | partial                                                         |
| In-flight handling                                                     | `QueryManager.ts` 205-234 (cancel/clear queued) | `use-filtered-query-rows.ts` 104-114 — `AbortController` aborts in-flight runs                 | partial — different mechanism, same goal                        |
| Throttle + rAF debounce                                                | `util/throttle.ts` 17-58, `MosaicClient.ts` 50  | None — every filter change re-queries immediately                                              | absent                                                          |
| Query consolidation                                                    | `QueryConsolidator.ts`                          | None — one query per widget per change                                                         | absent                                                          |
| Priority queue / concurrency cap                                       | `QueryManager.ts` 11-66                         | None — unbounded concurrent runs                                                               | absent                                                          |
| Preaggregation                                                         | `preagg/PreAggregator.ts`                       | None                                                                                           | absent — SL-015 scope, pointer only                             |
| URL persistence of filter state                                        | None — selections are session-state             | `filter.ts` 187-196 via `FilterUrlPort`                                                        | ours-only — SL-014 must reconcile chart selections with it      |

## What the port must decide (named, not decided)

| #   | Decision                   | The disagreement                                                                                                                                                                    |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Clause identity            | mosaic keys clauses by `source` object identity (`Selection.ts` 322-323); our filters key by string id (`filter.ts` 61). SL-013 picks what a "source" is for us                     |
| 2   | Predicate representation   | mosaic builds `ExprNode` trees (mosaic-sql); ours emits `{ sql, params }` bound fragments (ADR-0005). Union resolution needs OR over fragments — SL-013 picks the composition shape |
| 3   | Cross-filter skip          | mosaic skips clients listed on the clause (`Selection.ts` 337-342); our inputs simply never consume their own filter. SL-013/014 pick per-widget consumption semantics              |
| 4   | Empty default              | mosaic selections default to all-records (`empty: false`); our filters treat undefined as no predicate. SL-014 picks the default for chart-driven selections                        |
| 5   | Chart selections vs URL    | mosaic selections are session-state; our filters persist in the URL. SL-014 decides whether chart selections persist                                                                |
| 6   | Debounce and consolidation | mosaic throttles per-client with rAF debounce and consolidates per frame; SL-015 measures our query latency first, then decides                                                     |

## Pointers out of scope

| Topic                                                     | Where                                                                                                                                           | Consumer                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Chart interactors publishing clauses (brush/click/legend) | `research_repos/mosaic/packages/vgplot/vgplot/src/plot/interactors.js`                                                                          | SL-014 does its own fresh pass                        |
| Preaggregation internals                                  | `research_repos/mosaic/packages/mosaic/core/src/preagg/` (`PreAggregator.ts`, `lineage.ts`, `subquery-pushdown.ts`, `sufficient-statistics.ts`) | SL-015                                                |
| `wasmConnector` / DuckDB-WASM transport                   | `research_repos/mosaic/packages/mosaic/core/src/connectors/wasm.ts`                                                                             | Already chosen (ADR-0005); not an interaction concern |
