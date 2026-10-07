# SL-009 — Filter model + URL persistence + `filters=[...]` consumption

Milestone: Phase 1 · State: open · Depends on: SL-003, SL-006 · Closes: — (no `GAP-NNN` yet; R3 audit not run)

## Outcome

A reader can open `/weekly-review?region=West` and every data widget that declares `filters=["region"]` re-queries filtered — no per-fence `{{params.region}}` authoring — and the value survives a reload. Input widgets (SL-010/011) later write the same model; SL-013's selections join the same predicate path.

## Demo

1. Cold start: `bin/biac dev`, open `http://localhost:5173/weekly-review` — full-quarter data.
2. Open `http://localhost:5173/weekly-review?region=West` — widgets declaring `filters=["region"]` show West-only rows; the URL bar keeps the param.
3. Reload — the filtered view persists (URL read at filter construction).
4. Remove the param — full-quarter data returns.

## Who else implements this

Every path below was opened or listed on disk in the session that wrote this PRD.

| Repo      | Has it  | Entry points                                                                                                                                                                                                 | Approach in one line                                                                                                                                                                                                                                                                              |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | FULL    | `core/src/Filter.svelte.ts`, `core/src/Filters.svelte.ts`, `core/src/filter-predicate.ts`, `core/src/page-filters-context.ts`, `core/src/user-components/common/sql-options.ts`, `core/src/FILTER_SYSTEM.md` | Abstract `Filter` class (value priority URL > `initial_value` > data default; `value` writes URL via injected `replaceState`, `setDefault` never, `normalize` only when the param exists; snapshot no-op guard) + `Filters` map + per-widget `processFilterIds` → WHERE over the table expression |
| framework | PARTIAL | `src/client/stdlib/inputs.js`, `docs/inputs/index.md`                                                                                                                                                        | Re-exports `@observablehq/inputs`; `view()` binds an input's value to a reactive generator consumed by downstream code — no URL persistence, no declarative wiring                                                                                                                                |
| mosaic    | PARTIAL | `packages/mosaic/core/src/Param.ts`, `packages/mosaic/core/src/Selection.ts`, `packages/mosaic/core/src/clause/`                                                                                             | `Param`/`Selection` dynamic values with clause resolution — the substrate SL-013 ports; no URL persistence, no per-widget declarative wiring                                                                                                                                                      |
| streamlit | ABSENT  | `lib/streamlit/__init__.py` (line 289, `st.query_params` proxy)                                                                                                                                              | Widgets are server-state over protobuf; `st.query_params` is a manual read/write API — no automatic binding, no declarative wiring                                                                                                                                                                |

**Count:** 1 of 4 implements this fully. Evidence's filter system is the product's signature capability and the reason SL-009 is queued; mosaic's substrate is SL-013's port, not this slice's. Build it.

## Implementation inventory

### evidence

| Concern                        | Files                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model / schema            | `core/src/Filter.svelte.ts` — `FilterOpts` (serialize/deserialize/initialValue/dontUseQueryParam/queryOnly), `FilterDeps` (url/updateUrl/projectSettings/dialect); `core/src/user-components/tags/dropdown/schema.ts` — `value_column`, `multiple`, `select_first`, `initial_value` attributes                                                                                                    |
| Pipeline / execution           | `core/src/user-components/common/sql-options.ts` — `processFilterIds` (line 823: ids → `predicateSql` joined `AND`), `generateSQLQuery` (line 423: WHERE `(filterSql) AND (where) AND (dateFilter)` over the table expression); `core/src/Query.svelte.ts` — per-widget client, EVI-3119 comment at line 175 (loading must flip when the derived `dataQuery` changes)                             |
| Client / state                 | `core/src/Filter.svelte.ts` — `value` setter / `setDefault` / `normalize` / `applySerialized`, `lastSerialized` snapshot guard, `#isInitializing` construction guard; `core/src/Filters.svelte.ts` — SvelteMap, `create`/`createExternal` collision rule ("ensure exists"), `toSerialized`/`deserialize` round-trip; `core/src/page-filters-context.ts` — DI context (`createPageFiltersContext`) |
| UI entry point                 | `core/src/user-components/tags/dropdown/DropdownFilter.svelte.ts` — `predicateSql` via `value_column` + `renderColumnPredicate`; `cli/test-environment/pages/order-analysis.md` — authoring surface (`{% dropdown id value_column %}` + `filters=["channel_filter"]` on widgets)                                                                                                                  |
| Persistence of state           | URL search params via `window.history.replaceState` — `FILTER_SYSTEM.md` § Layout Constraint (the SvelteKit `{#key}` production incident is why native `replaceState`, never `$app/navigation`); § Dependencies — the same-source read/write invariant (`window.location.href` both ways)                                                                                                         |
| Empty / error / loading states | `FILTER_SYSTEM.md` § Known Issues #3 — undefined filter values interpolate to malformed SQL; a waiting-for-filters gate is needed; § Clearing Behavior — `select_first` + clear ambiguity (no distinct "user cleared" signal)                                                                                                                                                                     |
| Accessibility specifics        | Input-component a11y is SL-010/011 scope; streamlit is the widget UX reference there                                                                                                                                                                                                                                                                                                              |
| Edge cases it handles          | `FILTER_SYSTEM.md` § Falsy Values — `initialValue` truthiness drops `false`/`0` (Known Issue #2; fix with `!== undefined` in the port), `?id=` empty value = no param, serialize never returns `""`; slider out-of-range URL param corrected via `normalize`; § Cross-Page Persistence — orphan params accumulate (Known Issue #4)                                                                |
| Tests                          | `core/src/Filter.url-sync.test.ts`, `core/src/Filters.svelte.test.ts`, `core/src/user-components/tags/dropdown/Dropdown.initial-value.spec.test.ts`, `core/src/user-components/tags/dropdown/Dropdown.url-hydration.svelte.test.ts`, `core/src/user-components/tags/input-defaults-url.svelte.test.ts`                                                                                            |

### framework

| Concern              | Files                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Client / state       | `src/client/stdlib/inputs.js` — re-exports `@observablehq/inputs` (select, checkbox, range, search, text…)                         |
| Pipeline / execution | `docs/inputs/index.md` — `view()` pattern: input value → reactive generator → downstream queries                                   |
| Persistence of state | none — values are in-memory reactive state (grep for `searchParams`/`replaceState` in `src/` hits only `src/observableApiAuth.ts`) |

### mosaic

| Concern              | Files                                                                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client / state       | `packages/mosaic/core/src/Param.ts` — dynamic parameter with `AsyncDispatch`; `packages/mosaic/core/src/Selection.ts` + `packages/mosaic/core/src/clause/{Point,Interval,List,Match,SelectionClause}.ts` — clause resolution, the SL-013 substrate |
| Persistence of state | none — no `searchParams`/`replaceState` anywhere in `packages/mosaic/core/src/`                                                                                                                                                                    |

**Disagreements named:**

- **Predicate transport** — evidence text-interpolates predicates (`renderColumnPredicate` builds `col='v'` / `col IN (...)` with `escapeSqlValue`, dialect-aware); our `interpolate.ts` binds `{{params.x}}` as `?` placeholders. This slice decides (below).
- **Consumption point** — evidence's per-widget `Query` client rebuilds SQL per widget; no reference rewrites a shared registry. Our registry runs each named block once and widgets read results passively — the per-widget path must be added, not retrofitted onto the registry.
- **Filter declaration** — evidence filters exist because an input component (AST node) declares them; `evidence.filters.create` covers author runtime code. SL-009 has no input widgets (SL-010/011) — the declaration surface must be decided (below).

## Trade-offs and what we adopt

| Axis                | Options seen (repo → approach)                                                                                             | Trade-off                                                                                                                                                                 | Our choice, and why                                                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Predicate transport | evidence → text-interpolated `col='v'` with `escapeSqlValue`; ours → `?` placeholders (`interpolate.ts` precedent)         | Text interpolation matches evidence byte-for-byte but re-opens the injection surface ADR-0005 closed; placeholders keep values as prepared args                           | Placeholders: a predicate is `{sql, params}` (`region = ?` + `["West"]`); the wrapped query appends the args. Deviation from evidence, consistent with ADR-0004's `SELECT * FROM (<named_query>) WHERE <predicate>` shape and ADR-0005 |
| Reactivity          | evidence → Svelte 5 `$state` class + getter/setter + DI context; framework → reactive generators; mosaic → `AsyncDispatch` | Fine-grained reactivity is Svelte-native; React needs an explicit store                                                                                                   | Minimal subscription store (`subscribe`/`getSnapshot`) read through `useSyncExternalStore`; the semantics port 1:1 (value priority, `setDefault`/`normalize`, snapshot guard)                                                          |
| Consumption point   | evidence → per-widget `Query` client rebuilds SQL (`processFilterIds` → WHERE over table expression)                       | Per-widget matches ADR-0004's `makeClient` pattern and generalizes to SL-013's coordinator clients; registry-level rewrites would couple the registry to filter semantics | Per-widget: a filtered-query hook wraps the named query and re-runs on filter change; the registry keeps running unfiltered blocks                                                                                                     |
| Filter declaration  | evidence → input components declare filters (AST scan pre-registers for SSR); `evidence.filters.create` for author code    | SL-009 has no inputs yet; a declaration surface none of the references has would be an invention                                                                          | v1: `filters=["region"]` on a widget ensures filter `region` exists; its predicate column defaults to the id; the URL param name is the id. SL-010/011 inputs later carry a `column` attribute and the model keeps `column?` optional  |
| Empty predicate     | evidence → `processFilterIds` returns `undefined` when no filter contributes → the plain query runs                        | —                                                                                                                                                                         | Same: when no filter in the widget's list has a value, the widget reuses the registry's unfiltered result instead of issuing a second identical query                                                                                  |

## Gap analysis — what we already have vs the references

| Concern                | Ours today (file)                                                                                | Best reference (file)                                                    | Gap                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------- |
| Filter model           | absent — `src/web/src/features/` has `chrome/data/pages/widgets`, no `filters/`                  | `research_repos/evidence/core/src/Filter.svelte.ts`                      | absent                                 |
| URL persistence        | absent for filters — `{{params.x}}` reads the URL at query time only; no `replaceState` anywhere | `research_repos/evidence/core/src/Filter.svelte.ts` (setter)             | absent                                 |
| `filters=[...]` prop   | absent — no widget declares it                                                                   | `research_repos/evidence/core/src/user-components/common/sql-options.ts` | absent                                 |
| Per-widget re-query    | absent — widgets read registry results passively (`use-chart-rows.ts`, `table.tsx`)              | `research_repos/evidence/core/src/Query.svelte.ts`                       | absent                                 |
| Params → query binding | present — `interpolate.ts` + `query-registry.tsx` re-run blocks when `params` change             | `research_repos/evidence/core/src/interpolate-query-strings.ts`          | complete (different surface; coexists) |

Ours is **absent**. The ledger's SL-003/SL-006 claims survive: `{{params.x}}` is the raw authoring surface and stays; filters are the structured surface on top.

## Deviations

- **Placeholder-bound predicates** (vs evidence's `escapeSqlValue` text interpolation) — ADR-0005's injection posture; SL-013's clause port inherits this shape.
- **v1 filter column defaults to the filter id** — evidence separates `id` from `value_column` because an input declares both; SL-009 has no inputs, so `filters=["region"]` is self-contained (`?region=West` → `region = ?`). The model keeps `column?` so SL-010/011 inputs can carry the attribute.
- **No cross-page filter persistence** — evidence's `beforeNavigate` cancel+goto merge is SvelteKit-specific (`FILTER_SYSTEM.md` § Cross-Page Persistence); a TanStack Router equivalent is its own later concern. Not carrying params across pages also avoids evidence's orphan-param accumulation (Known Issue #4).
- **No SSR story** — `biac dev`/`biac build` render client-side (ADR-0005); evidence's server context (URL read, no write) has no analog yet.

## Open decisions

None left open — the four disagreements above are decided with evidence cited in this session. If T1 execution surfaces a new one, it is added here before code is written.

## Surface

| Layer  | Files                                                                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | none — `filters={["region"]}` is a plain MDX prop; the pipeline is untouched                                                                 |
| client | `src/web/src/features/filters/filter.ts`, `src/web/src/features/filters/filters.ts`, `src/web/src/features/filters/page-filters-context.tsx` |
| ui     | `src/web/src/features/pages/markdown-page.tsx` (page-scoped provider mount, T1); widget `filters` props (T3)                                 |
| tests  | colocated `*.unit.test.ts(x)` in `src/web/src/features/filters/`; `test/e2e-browser/` spec (T4)                                              |

## Tasks

One TDD unit each, one conventional commit each.

- [x] T1 — Filter model core: `src/web/src/features/filters/` — `Filter` port (value priority URL > initial > `setDefault` > undefined; `value` setter writes the URL through an injected port under the `lastSerialized` snapshot guard and the construction guard; `setDefault` never writes; `normalize` writes only when the param is present; `applySerialized`; `predicate()` → `{sql, params} | undefined`), `Filters` collection (`ensure` create-or-return, `get`/`has`/`remove`), `FiltersProvider` + `usePageFilters` context with an injected `FilterUrlPort` (`read(): URL | undefined`, `write(url): void`), mounted page-scoped in `markdown-page.tsx`. Unit tests drive a named fake port; no UI change.
- [ ] T2 — `filters=[...]` consumption: the registry exposes each block's interpolated SQL + params; a `useFilteredQueryRows(name, filterIds)` hook wraps `select * from (<interpolated>) where <preds>` with bound args, re-runs on filter change, reuses the registry result when no filter contributes, cancels in-flight work on change. Unit tests with `FakeDuckDb`.
- [ ] T3 — Widget props: `filters` (`string | string[]`) on `<Table>`, the charts, `<BigValue>`/`<Value>`/`<Delta>`/`<Sparkline>`; stories for filtered/unfiltered states; web-unit tests.
- [ ] T4 — Demo + e2e: `pages/weekly-review.md` widgets declare `filters=["region"]`; `test/e2e-browser/` spec drives the URL (typing the URL is the user interaction for this slice); cucumber feature; the demo script above is run by a human; ship.

## Out of scope

- Input widgets (`<Dropdown>`, `<MultiSelect>`, `<Slider>`, …) — SL-010/011; they write this model and own a11y/empty-state behavior (streamlit reference).
- `<FilterBar>` chips — SL-012.
- Cross-filter coordinator/selections (chart-driven clauses, `cross`, debounce) — SL-013/014/015; SL-009's predicates are the filter-model half those selections join.
- Cross-page filter persistence (URL param merging on navigation) — later slice; evidence's mechanism is SvelteKit-specific.
- `{{inputs.x}}` template tokens — `interpolate.ts` errors on them today by design; a later slice decides the inputs surface.
