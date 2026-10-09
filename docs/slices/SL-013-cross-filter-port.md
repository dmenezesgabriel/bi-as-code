# SL-013 — Cross-filter coordinator: selections re-query linked widgets

Milestone: Phase 1 · State: open · Depends on: SL-009, SL-010, SL-011 · Evidence: `docs/research/interaction-reference.md` (R2) · Closes: —

> Written per `docs/slices/_TEMPLATE.md`. Every `research_repos/` path below was verified with `test -e` in the session that wrote this file (2026-10-08). Line ranges rot — paths are the citation; open the file.

## Outcome

A filter change publishes a typed clause through a page coordinator; every widget linked to that selection re-queries individually under a resolution strategy; and a widget that publishes a clause can consume its own selection without filtering itself (`cross` exclude-self).

## Demo

1. Cold start: `bin/biac dev`, open `http://localhost:5175/weekly-review`.
2. Record before numbers: region `<Table>` row count, `<BarChart>` bar count, Region `<Dropdown>` option count, `console` output.
3. Pick `West` in the Region dropdown — BarChart, ScatterChart, Histogram and both tables narrow; the dropdown's own options stay complete.
4. Drag the Amount slider to a narrow range — Histogram and the order-detail table narrow; the dropdown's options narrow to regions with orders inside the range (its options query declares `filters={["region", "amount"]}` on a fence that carries `amount`).
5. Pick `East` in the dropdown — its options do not narrow to `East` (the region clause skips the dropdown's own client), while every other linked widget re-queries.
6. Reload — `?region=East&amount=…` persists; URL semantics are unchanged (SL-009).

The dropdown's options source moves from the `orders` fence (which projects only `region`, `orders`, `revenue` — an `amount` predicate against it is a binder error) to `order_amounts` (projects `order_date`, `amount`, `region`); option values dedupe, so the option set stays the same three regions.

## Who else implements this

| Repo      | Has it  | Entry points                                                                                                          | Approach in one line                                                                                                                          |
| --------- | ------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | ABSENT  | `research_repos/evidence/core/src/FILTER_SYSTEM.md`                                                                   | Filter model + `filters=[...]` consumption per widget; no coordinator, no clause model — each widget re-queries on filter change              |
| framework | PARTIAL | `research_repos/framework/src/client/stdlib/vgplot.js`                                                                | Delegates to mosaic: the stdlib bundles vgplot and wires `new vgplot.Coordinator()` + `wasmConnector`; pages embed mosaic dashboards          |
| mosaic    | FULL    | `research_repos/mosaic/packages/mosaic/core/src/{Coordinator,Selection,Param,MosaicClient,make-client}.ts`, `clause/` | The reference: a Coordinator owns clients and filter groups; Selections resolve clauses under strategies; clients re-query `query(predicate)` |
| streamlit | ABSENT  | `research_repos/streamlit/lib/streamlit/elements/widgets/`                                                            | Widgets trigger a script rerun; no client-side cross-widget coordinator                                                                       |

**Count:** 1 of 4 implements it (mosaic), and framework consumes it through the official bridge. [ADR-0004](../adr/0004-cross-filter-is-ported-from-the-mosaic-architecture.md) already decided the native port; this slice executes it. evidence's absence is why the Filter value model (SL-009) and the coordinator (this slice) are separate layers that compose.

## Implementation inventory

### mosaic

| Concern                        | Files                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model / schema            | `research_repos/mosaic/packages/mosaic/core/src/clause/SelectionClause.ts` (clause shape: `source`/`clients`/`fields`/`value`/`predicate`/`meta`), `clause/PointClause.ts`, `clause/IntervalClause.ts`, `clause/ListClause.ts`, `clause/MatchClause.ts`                                                        |
| Pipeline / execution           | `research_repos/mosaic/packages/mosaic/core/src/Coordinator.ts` (`filterGroups`, `updateSelection`, `updateClient`); `QueryManager.ts` + `QueryConsolidator.ts` are SL-015 scope                                                                                                                               |
| Client / state                 | `research_repos/mosaic/packages/mosaic/core/src/Selection.ts` (strategies, `resolve`, `skip`, `predicate`), `Param.ts` + `util/AsyncDispatch.ts` (dispatch + queue), `MosaicClient.ts` (client contract), `make-client.ts` (bridge)                                                                            |
| Persistence of state           | none — selections are session-state; ours keeps URL persistence (see Trade-offs)                                                                                                                                                                                                                               |
| Empty / error / loading states | `Selection.ts` 359-361 (`empty` → `literal(false)`), `Coordinator.ts` 215-232 (`queryPending`/`queryResult`/`queryError` lifecycle)                                                                                                                                                                            |
| Accessibility specifics        | n/a — model layer                                                                                                                                                                                                                                                                                              |
| Edge cases it handles          | `Selection.ts` 317-328 (replace-by-source, null-predicate clears, `single` resets dropped sources), `Selection.ts` 337-342 (skip), `Selection.ts` 97-107 (include relay); behavior pinned by `test/selection.test.ts`, `test/selection-clause.test.ts`, `test/coordinator.test.ts`, `test/make-client.test.ts` |

### framework

| Concern        | Files                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Client / state | `research_repos/framework/src/client/stdlib/vgplot.js` — 10 lines: coordinator + API context + `wasmConnector({duckdb})` wiring |

evidence and streamlit are absent — no inventory rows.

## Trade-offs and what we adopt

| Axis                          | Options seen (repo → approach)                                                                                                                                                 | Trade-off                                                                                                            | Our choice, and why                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clause identity (#1)          | mosaic → `source` object identity (`Selection.ts` 322-323); ours-today → string filter id (`filter.ts` 61)                                                                     | Object identity needs a stable instance per source; string ids are page-scoped anyway                                | The `Filter` instance is the clause `source` (stable via `Filters.ensure`); the id string stays the URL/registry key. Matches mosaic's resolve-by-identity; page-scoped instances cannot collide                                                                                                                   |
| Predicate representation (#2) | mosaic → ExprNode trees (`or(predicates)`, implicit conjunction); ours → bound `{sql, params}` fragments (ADR-0005)                                                            | Trees compose structurally; fragments compose textually and need parenthesization                                    | Bound fragments, composed with per-fragment parens: `(p1) AND (p2)` / `(p1) OR (p2)`, params concatenated in clause order. ADR-0005 mandates it; today's `use-filtered-query-rows.ts` 34-36 joins unparenthesized — the composer fixes precedence                                                                  |
| Cross-skip (#3)               | mosaic → per-clause `clients` Set gated by the selection's `cross` flag (`Selection.ts` 337-342, 363-369); ours-today → inputs never declare their own filter                  | Per-clause sets generalize to charts (SL-014); a selection-level flag alone cannot express "skip only the publisher" | Port both, verbatim: `skip(client, clause) = cross && clause.clients?.has(client)`. Filter-owned selections and consumption composites default `cross: true` — the input's own options query is the canonical self-consumer; no shipped page declares a self-filter today, so the default changes nothing existing |
| Who attaches the own-client   | mosaic → clause constructors default `clients = new Set([source])` when the source is a client (`clause/PointClause.ts` 46); ours → the `Filter` publishes but is not a client | The publisher must know its own client to attach                                                                     | The data hook takes the owning filter id and registers its client on that filter; the `Filter` attaches registered clients to every clause it publishes. Unregistered publishers (charts in SL-014 attach themselves) publish without a client                                                                     |
| Query execution ownership     | mosaic → the Coordinator owns the connector + QueryManager; ours → the data runtime is a React context below `FiltersProvider` and the registration gate is per page           | Coordinator-owned execution needs the runtime at construction, above the registry                                    | The coordinator is a pure broker; clients carry their own runner (runtime + registered block + wrapped query) at connect. Priorities/cache/consolidation stay SL-015                                                                                                                                               |
| Empty default (#4)            | mosaic → `empty: false` (no clauses = all records); SL-014 decides for chart selections                                                                                        | —                                                                                                                    | `empty: false` everywhere in SL-013; the flag ports with the default. No clauses → the bridge reuses the registry's unfiltered result (today's behavior), the coordinator issues no query                                                                                                                          |

## Gap analysis — what we already have vs the references

| Concern                                                             | Ours today (file)                                                                                              | Best reference (file)                      | Gap                                                                     |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Clause object                                                       | `src/web/src/features/filters/filter.ts` 15-18 — `FilterPredicate {sql, params}` only                          | `clause/SelectionClause.ts` 22-57          | absent — no source, clients, fields, value or meta                      |
| Replace-by-source clause updates                                    | `src/web/src/features/filters/filter.ts` 97-106 — one value per filter id                                      | `Selection.ts` 317-328                     | absent (value model, not clause model)                                  |
| Resolution strategies (intersect/union/single)                      | `src/web/src/features/filters/use-filtered-query-rows.ts` 34-36 — declared filters always AND-ed               | `Selection.ts` 287-391                     | absent                                                                  |
| Cross-filtering (exclude publishing client)                         | inputs never re-query their own data; no per-clause client exclusion exists                                    | `Selection.ts` 337-342, 363-369            | absent                                                                  |
| Empty selection                                                     | `src/web/src/features/filters/filter.ts` 178 — undefined value → no predicate → all records                    | `Selection.ts` 359-361                     | absent as a flag; behavior equivalent at the default                    |
| Coordinator (central query broker)                                  | `src/web/src/features/filters/page-filters-context.tsx` broadcasts state; each widget re-queries independently | `Coordinator.ts` 297-395                   | partial — broadcast without filter groups, per-client lifecycle or skip |
| Client contract (`query`/`queryPending`/`queryResult`/`queryError`) | `src/web/src/features/filters/use-filtered-query-rows.ts` 101-115 — hook-local loading/error                   | `MosaicClient.ts` 144-173                  | partial                                                                 |
| In-flight handling                                                  | `src/web/src/features/filters/use-filtered-query-rows.ts` 104-114 — `AbortController`                          | `QueryManager.ts` 205-234                  | partial — different mechanism, same goal; keep until SL-015 measures    |
| URL persistence of filter state                                     | `src/web/src/features/filters/filter.ts` 187-196 via `FilterUrlPort`                                           | none — mosaic selections are session-state | ours-only — kept; SL-014 reconciles chart selections with it            |

State: the cross-filter machinery is absent; the value model it feeds on is complete (SL-009 shipped). No ledger row claims any of this — SL-013 is the first cross-filter row.

## Deviations

- `clauseList` ports multi-value membership (`field IN (?, …)`, the single-field path of mosaic's `clausePoints`), not mosaic's LIST-column `listHasAny`/`listHasAll` — our inputs and SL-014 legend toggles need IN-membership; no LIST-typed column consumer exists in the product.
- `clauseInterval` supports half-open extents (`>= ?` lo-only, `<= ?` hi-only) — mosaic's is strictly `isBetween([lo, hi])`; our Slider and DateRange publish half-open states.
- `clausePoint` emits `field = ?` for a scalar (our pinned input default), not mosaic's `isInDistinct` — values are non-NULL input scalars — and clears on `null` as well as `undefined` (our filter values treat null as cleared, `filter.ts` 178; mosaic builds a NULL literal).
- The `QueryClient` contract keeps mosaic's four callbacks but types them to our shapes: `query(predicate)` returns the wrapped `InterpolatedQuery` (mosaic returns a Query builder), `queryResult(rows)` carries rows (mosaic passes the decoded table), `queryError(message)` a display-ready string (mosaic a `QueryError`). The loading/error/success state union stays the bridge's React state, not the contract's.
- The `AsyncDispatch` queue + `emitQueueFilter` coalescing is not ported; latest-wins via cancellation covers it until SL-015 measures (decision #6).
- The `enabled`/`prepare`/`initialize` client lifecycle is not ported — `run-block.ts` awaits the page's registration gate, which is our initialization; offscreen disabling has no consumer yet.
- Clause `fields` are column-name strings, not mosaic's `ExprNode` instances with strict reference equality — our predicates are bound fragments, so field identity is informational.
- Clause `meta` carries only `{ type }`; mosaic's interval metadata (`pixelSize`, `scales`, `bin`) are preagg hints — SL-015 scope.

## Open decisions

None — the three decisions SL-013 owns are settled in Trade-offs with evidence. SL-014 owns #4 (chart-selection empty default) and #5 (chart selections vs URL); SL-015 owns #6 (debounce/consolidation).

## Surface

| Layer  | Files                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | none — the `filters={...}` prop already parses and ships (SL-009)                                                                                                                                                                                                                                                                                                                                                                  |
| client | `src/web/src/features/crossfilter/types.ts` (new — clause, source and client-contract types), `clause.ts` (new), `selection.ts` (new), `coordinator.ts` (new — the model layer stays framework-free: no React, no context imports; the makeClient-style bridge lands in `use-filtered-query-rows.ts` at T4, since it needs the filters/pages contexts and `crossfilter` must never import `filters`)                               |
| ui     | `src/web/src/features/filters/filter.ts` (clause publication), `src/web/src/features/filters/filters.ts` (selection per id), `src/web/src/features/filters/page-filters-context.tsx` (page coordinator), `src/web/src/features/filters/use-filtered-query-rows.ts` (coordinator client, external contract unchanged), `src/web/src/features/widgets/inputs/` (builders → clause factories), `pages/weekly-review.md` (demo markup) |
| tests  | `src/web/src/features/crossfilter/*.unit.test.ts(x)` (new, colocated — `web-unit` project); existing filters/widgets suites stay green; `test/e2e/` + `test/e2e-browser/` specs for the demo                                                                                                                                                                                                                                       |

## Tasks

One TDD unit each, one conventional commit each. A task that changes a screen names what to navigate and measure — the executing session closes it with a `playwright-cli` pass (`prompt-execution.md` §5).

- [x] T1 — Clause model: `src/web/src/features/crossfilter/types.ts` + `clause.ts` — `SelectionClause`/`ClauseSource`/`QueryClient` types (the `FilterPredicate` fragment type moves here from `src/web/src/features/filters/filter.ts` so `crossfilter` never imports `filters`); constructors `clausePoint`/`clauseList`/`clauseInterval`/`clauseMatch`/`clauseNone` emitting bound predicates; `composeAnd`/`composeOr` (parenthesized, params concatenated, empty → `undefined`). Unit tests port the semantics mosaic pins in `test/selection-clause.test.ts` plus our deviations (cleared-when per type, empty array clears, half-open intervals, match methods + case-insensitivity, composition precedence).
- [x] T2 — `src/web/src/features/crossfilter/selection.ts`: strategies (intersect/union/single), replace-by-source, null-predicate clears, active clause, `cross`/`empty` flags, `predicate(client)` with skip, `valueFor`/`remove`/`reset`, `include` relay, `subscribe`. Unit tests from mosaic `test/selection.test.ts` semantics.
- [x] T3 — `src/web/src/features/crossfilter/coordinator.ts`: the `QueryClient` contract (`query`/`queryPending`/`queryResult`/`queryError`), filter groups, connect/disconnect, publish→re-query per client with cancellation, skip → no query. Integration tests with `FakeDuckDb` and a hand-rolled fake client (mosaic `test/coordinator.test.ts` as evidence).
- [ ] T4 — Wire through: the makeClient-style bridge lands in `use-filtered-query-rows.ts` (it implements `QueryClient` and connects with the page's runner); `Filters` owns a `Selection` per id (`cross: true`); `Filter` publishes a clause on every value change (the clause factory comes from the input's options); external contract unchanged, own-client registration for inputs that query data; `sliderPredicate`/`dateRangePredicate` re-expressed as clause factories. All widget suites stay green.
- [ ] T5 — Demo + ship: the weekly-review cross demo markup, e2e specs, playwright measurements (rows/bars/options before-after, query latency, `console` clean), ledger edit to `shipped` after the human demo, then delete this PRD.

## Out of scope

- Chart-published selections (brush/click/legend interactors, `select: crossfilter` syntax, the chart-selection empty default — decisions #4/#5): SL-014.
- Throttle, rAF debounce, query consolidation, priority queue, preaggregation, activation prefetch (decision #6): SL-015.
- Multi-field clause variants (`clausePoints` N-field, `clauseIntervals`, `clauseMatchAny`) and mosaic's LIST-column `clauseList`: SL-014 adds them if its interactors need them.
- Remote connectors, data loaders: later phases.
