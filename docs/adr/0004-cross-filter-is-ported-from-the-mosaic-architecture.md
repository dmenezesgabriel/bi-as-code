# ADR-0004 — Cross-filtering is a native port of the Mosaic architecture, not a dependency on it

Status: accepted
Date: 2026-10-03

## Context

The product's core promise is rich, performant cross-filtering: brushing a chart or picking values in an input re-queries every linked widget. Interactive cross-filtering is a solved problem with a precise architecture — a coordinator that publishes selection predicates to data clients — and re-inventing that architecture from instinct would produce the usual failure modes (per-widget ad-hoc state, no exclude-self semantics, runaway re-queries).

The Mosaic documentation and source describe the architecture completely: a `Coordinator` owns data clients; `Selection`s hold typed `SelectionClause`s (point, interval, list, match) with resolution strategies (intersect/union/single); a client's predicate is the resolved clauses minus the clauses the client itself published (`cross`); widgets re-run `query(predicate)` and the predicate is pushed into SQL.

## Decision drivers

- Parity with a proven architecture over a bespoke one.
- No dependency on a library whose API surface, release cadence and internals we do not control — the mandate is to use the reference as evidence, not as a package.
- The port must stay small: semantics, not the reference's full API surface (params system, preaggregation, spec format are deferred).

## Options considered

| Option                       | Pro                                       | Con                                                                         |
| ---------------------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| Depend on `@uwdata/mosaic-*` | Zero porting cost; upstream fixes flow in | User directive excludes it; adds a large API surface we cannot shape        |
| Invent our own model         | Full freedom                              | Guaranteed to re-derive the same architecture worse, with new failure modes |
| Port the semantics           | Proven architecture under our control     | We own the bugs and the maintenance                                         |

## Decision

Cross-filtering is implemented natively in `src/web/src/features/crossfilter/` as a semantic port of the Mosaic model:

- A `Coordinator` registers data clients and republishes on selection change.
- A `Selection` resolves its clauses to a SQL predicate under a strategy (`intersect`, `union`, `single`) and supports `cross` (exclude-self) and `empty` (no clauses means match-nothing).
- Clause types are `point`, `interval`, `list`, `match` — the vocabulary every widget speaks.
- A widget's effective predicate is pushed into SQL as `SELECT * FROM (<named_query>) WHERE <predicate>`; queries that cannot accept a predicate (DDL, unfilterable shapes) are rejected at the widget boundary.
- The React bridge follows the reference's `makeClient` pattern: a hook creates a client inside `useEffect` with `query`/`queryResult`/`queryPending`/`queryError` handlers.

Chart interactions map to clauses: brush ranges → `interval`, click on a mark → `point`, legend/category toggles → `list`, search-as-you-type → `match`. Filter inputs own named selections; `filters=["id"]` on a widget includes those selections' clauses; `select: crossfilter` declares a chart-published selection.

Chart-published selections follow the reference's semantics, not the input model's:

- They are session state. A chart clause never writes the URL and never sets an input's `Filter.value`; inputs remain the only persisted filter state. Publishing through `Filter.value` would make the input the clause's source, so `cross` could no longer exclude the chart from its own selection.
- The target selection is the bound field's name (filter id ⇄ column), so a chart and an input on the same field publish into one selection. Their clauses AND together (`intersect`); replace-by-source is per publisher, not per field. A chart pick does not "switch" an input's pick.
- The publishing chart keeps its own rows and de-emphasizes its unselected marks from the clause value it just published — no per-mark test query.

Performance mechanisms from the reference (query consolidation, preaggregation) are deliberately deferred to their own slices.

## Consequences

We own a ~small, well-understood module whose semantics a reader can check against an ADR. The cost is that performance work the reference already did (consolidation, preagg) must be re-earned per slice — accepted, since unmeasured optimization is worse.

Any future temptation to "simplify" the exclude-self rule or the empty-selection semantics is countered by this record: those are the load-bearing semantics the architecture exists for.
