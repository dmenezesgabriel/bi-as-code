# SL-011 — Slider, DateRange, TextInput, ButtonGroup, Toggle filter inputs

Milestone: Phase 1 — A usable BI-as-code product · State: open · Depends on: SL-009, SL-010 · Closes: —

## Outcome

A page author can place five more filter inputs in markdown — `<Slider>`, `<DateRange>`, `<TextInput>`, `<ButtonGroup>`, `<Toggle>` — each binding a named page filter whose value persists in `?id=` URL params, feeds `filters=[...]` predicates where the input carries a column, and re-queries `{{params.id}}`-interpolating fences on change.

## Demo

A numbered script a human runs from a cold start. The slice is not `shipped` until this has been run in the real app.

1. `pnpm build && pnpm preview`, open `http://localhost:4173/weekly-review` — the page shows the existing Region `<Dropdown>` plus a `<Slider>` on `amount`, a `<DateRange>` on `order_date`, a `<TextInput>` `q`, and a `<Toggle>` `large_orders`.
2. Drag the slider's min thumb — `?amount=` becomes `"a - b"` and the `<Table>`/`filters=["amount"]` widgets re-query to `amount BETWEEN a AND b`.
3. Pick "Last 30 days" in `<DateRange>` — `?ordered=last%2030%20days`; reload — the param stays the range expression, so the window re-rolls from today rather than pinning dates.
4. Type in `<TextInput>` — `?q=` updates after a short debounce; the fence interpolating `{{params.q}}` re-queries.
5. Flip `<Toggle>` — `?large_orders=true`; `{{params.large_orders}}`-interpolating fences re-query.
6. Open `/nested/allocation` — `<ButtonGroup>` over `channel` writes `?channel=Direct` (or `?channel=["a","b"]` in `multiple` mode) and the `<Table filters="channel">` narrows; the existing `<MultiSelect>` is unaffected.
7. Reload every touched URL — each input restores its widget state from its param.

## Who else implements this

Every reference repo gets a row, including the ones that do not have it. Counts per widget:

| Repo      | Slider                                                             | DateRange                                                                       | TextInput                                                                | ButtonGroup                                                                         | Toggle                                                          |
| --------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| evidence  | FULL `core/src/user-components/tags/slider/`                       | FULL `core/src/user-components/tags/range_calendar/`                            | FULL `core/src/user-components/tags/text_input/`                         | FULL `core/src/user-components/tags/button_group/` (+`input_tabs`)                  | FULL `core/src/user-components/tags/toggle/`                    |
| framework | PARTIAL `docs/inputs/range.md` — `Inputs.range`, single value only | PARTIAL `docs/inputs/date.md` — `Inputs.date`, single date, no range            | FULL `docs/inputs/text.md`, `docs/inputs/search.md`                      | PARTIAL `docs/inputs/{radio,checkbox}.md` — grouped options, not segmented          | FULL `docs/inputs/toggle.md`                                    |
| mosaic    | FULL `packages/vgplot/inputs/src/Slider.js`                        | ABSENT                                                                          | PARTIAL `packages/vgplot/inputs/src/Search.js` — match-clause search box | ABSENT                                                                              | ABSENT                                                          |
| streamlit | FULL `lib/streamlit/elements/widgets/{slider,select_slider}.py`    | FULL `lib/streamlit/elements/widgets/time_widgets.py` (`date_input` range mode) | FULL `lib/streamlit/elements/widgets/text_widgets.py`                    | FULL `lib/streamlit/elements/widgets/button_group.py` (`segmented_control`/`pills`) | FULL `lib/streamlit/elements/widgets/checkbox.py` (`st.toggle`) |

**Count:** evidence 5/5, streamlit 5/5, framework ~4/5 partial (no date-range widget, impl lives in the external `@observablehq/inputs` package — `src/client/stdlib/inputs.js` re-exports), mosaic 2/5. Three of four products ship all or most of these; the capability is standard, not invented.

## Implementation inventory

Files to open per repo, grouped by concern — read the real code, don't take this table's word.

### evidence (`research_repos/evidence/`)

| Concern                 | Files                                                                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prop schemas            | `core/src/user-components/tags/{slider,range_calendar,text_input,button_group,toggle}/schema.ts`                                                                                                                                                                                              |
| Filter binding          | `core/src/user-components/tags/{slider,range_calendar,text_input,button_group,toggle}/{SliderFilter,RangeCalendarFilter,TextInputFilter,ButtonGroupFilter,ToggleFilter}.svelte.ts`, `core/src/Filter.svelte.ts`, `core/src/Filters.svelte.ts`, `core/src/FILTER_SYSTEM.md`                    |
| Predicate rendering     | `core/src/filter-predicate.ts` (`renderColumnPredicate` — `=`/`IN`, text-interpolated escaped values), `core/src/sql-dialect.ts` (`escapeSqlValue`)                                                                                                                                           |
| UI — Slider             | `core/src/user-components/tags/slider/Slider.svelte` (~600 lines: `data`+`value_column` bounds query, `show_input` numeric fields, clamping, `snap_to_step`, `fmt`), `core/src/shadcn/components/ui/{slider,input,label,skeleton}.svelte`                                                     |
| UI — RangeCalendar      | `core/src/user-components/tags/range_calendar/RangeCalendar.svelte` (~500 lines: bits-ui calendar grid in a Popover, preset list, `all_time_range`), `core/src/shadcn/components/ui/{range-calendar,popover,button,label}.svelte`                                                             |
| UI — TextInput          | `core/src/user-components/tags/text_input/TextInput.svelte` (per-keystroke `bind:value` → `filter.value`, lucide `icon`, `title ?? formatTitle(id)`), `core/src/shadcn/components/ui/{input,label}.svelte`, `core/src/user-components/formatTitle.ts`                                         |
| UI — ButtonGroup        | `core/src/user-components/tags/button_group/ButtonGroup.svelte` (shadcn `toggle-group`, `orientation`, `multiple`, `select_first`, `order`), `core/src/user-components/tags/button_group/button-group-context.ts`, `core/src/user-components/tags/option/` (child `<option>` tags)            |
| UI — Toggle             | `core/src/user-components/tags/toggle/Toggle.svelte` (shadcn `switch` + `label` + `info`), `core/src/shadcn/components/ui/switch.svelte`                                                                                                                                                      |
| Date-range engine       | `core/src/user-components/common/date-options.ts` (`processDateRange`, `resolveDateRange`, `PRESET_DEFINITIONS`, `'YYYY-MM-DD to YYYY-MM-DD'`/`from`/`until`/`last N <unit>`/`today`/`yesterday` grammar), `core/src/user-components/common/custom-ranges.ts`, `core/src/utils/date-utils.ts` |
| State persistence       | `core/src/Filter.svelte.ts` — each `*Filter.svelte.ts` constructor supplies `serialize`/`deserialize`; URL param is the persistence layer                                                                                                                                                     |
| Empty / error / loading | `Slider.svelte` skeleton + clamp branches; `RangeCalendar.svelte` `Ellipsis` busy state; `filter-null-clearing.test.ts` (cleared values)                                                                                                                                                      |
| Accessibility           | `core/src/shadcn/components/ui/` primitives are bits-ui — aria roles, roving focus, keyboard nav live there; widget-level: `Label for={id}` in every `*.svelte`                                                                                                                               |
| Edge cases              | `core/src/user-components/tags/slider/SliderFilter.svelte.test.ts`, `core/src/user-components/tags/range_calendar/{schema.test.ts,RangeCalendarFilter.svelte.test.ts}`, `core/src/user-components/tags/input-defaults-url.svelte.test.ts` (URL ↔ defaults), `filter-null-clearing.test.ts`    |

### framework (`research_repos/framework/`)

| Concern           | Files                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prop/UX semantics | `docs/inputs/{range,date,text,search,toggle,radio,checkbox,button}.md` — `submit` deferral option, `min`/`max` bounds, `value` shapes, placeholder   |
| Re-export         | `src/client/stdlib/inputs.js` — the impl is `@observablehq/inputs` on npm, not in this repo; the docs pages are the source of truth for its contract |
| Persistence       | none — Inputs values live in the notebook runtime, not the URL                                                                                       |

### mosaic (`research_repos/mosaic/`)

| Concern             | Files                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Slider              | `packages/vgplot/inputs/src/Slider.js` — `from`+`column` → `select min,max` bounds query; `select: 'point'                                            | 'interval'`; `publish`per`input` event |
| Text search         | `packages/vgplot/inputs/src/Search.js` — `clauseMatch(field, value, {method})` per keystroke, empty → null                                            |
| Input base          | `packages/vgplot/inputs/src/input.js` — `Input`/`input()`: `filterBy` cascade into the bounds source, `as` accepts `Param` or `Selection`, `activate` |
| Clause constructors | `packages/mosaic/core/src/clause/` — `clausePoint`/`clauseInterval`/`clauseMatch` semantics (deep-dive deferred to R2/SL-013)                         |
| Persistence         | none — `Selection`/`Param` objects, not URL                                                                                                           |

### streamlit (`research_repos/streamlit/`)

| Concern                | Files                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Widget APIs            | `lib/streamlit/elements/widgets/{slider,select_slider,text_widgets,time_widgets,button_group,checkbox,radio}.py` — `min_value`/`max_value`/`step`/`format`/`value` shapes            |
| Text debounce          | `lib/streamlit/elements/widgets/text_widgets.py` — `live` option + `_MAX_LIVE_DEBOUNCE_MS` normalization                                                                             |
| Frontend — Slider      | `frontend/lib/src/components/widgets/Slider/`                                                                                                                                        |
| Frontend — DateInput   | `frontend/lib/src/components/widgets/DateInput/` (`{DateInput,RangeDateInput,SingleDateInput,CalendarPopoverHeader}.tsx`, `dateInputUtils.ts`) — segmented fields + calendar popover |
| Frontend — TextInput   | `frontend/lib/src/components/widgets/TextInput/`                                                                                                                                     |
| Frontend — ButtonGroup | `frontend/lib/src/components/widgets/ButtonGroup/`                                                                                                                                   |
| Frontend — Toggle      | `frontend/lib/src/components/widgets/Checkbox/` (toggle visual)                                                                                                                      |
| Persistence            | widget state manager, not URL                                                                                                                                                        |

## Trade-offs and what we adopt

| Axis                          | Options seen (repo → approach)                                                                                                     | Trade-off                                                                   | Our choice, and why                                                                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slider single-value predicate | evidence → `col >= v` (threshold) · mosaic → `col = v` (`select:'point'`) or `min..v` (`'interval'`)                               | `=` is useless on continuous data; `>=` reads as "minimum"                  | evidence — `>=` single, `BETWEEN` range; `valueColumn` is the predicate column                                                                                                                                          |
| Slider bounds source          | evidence+mosaic → query `min(vc), max(vc)` off `data` · static `min`/`max` props                                                   | data-derived bounds track the data; static is trivial but drifts            | both: `data`+`valueColumn` reduces the fence's own rows (like `<Dropdown>`'s option source), else `min`/`max`/`step` props                                                                                              |
| Predicate values              | evidence → text-interpolated escaped literals (`renderColumnPredicate`) · ours → `?`-bound params                                  | bound params are injection-proof; literals need dialect escaping            | ours — `FilterPredicate.sql` + `params` (ADR-0005), unchanged                                                                                                                                                           |
| TextInput/Toggle consumption  | evidence → `{{id}}` template values, `sql` getter undefined (no `filters=[...]` predicate) · streamlit → widget state              | a predicate per keystroke is wrong; a toggle's `=` needs opt-in anyway      | `{{params.id}}` reads the URL param today (registry already re-interpolates on `replaceState`); `filters=[...]` still emits `col = ?` only when the input set a `column` — `column: false` marks never-predicate inputs |
| TextInput write cadence       | evidence → every keystroke · mosaic → every `input` event · streamlit → `live` debounce                                            | per-keystroke URL writes re-run every subscribed query                      | debounce the `filter.value` commit ~300ms; blur/Enter commits immediately                                                                                                                                               |
| Toggle `invert`               | evidence → URL stores raw UI state, `invert` flips only the emitted `{{id}}` value                                                 | two surfaces disagree (param ≠ template value)                              | ours has one surface: `?id=` IS the emitted boolean — `invert` flips the stored value; the switch's checked face is `value XOR invert`                                                                                  |
| DateRange value model         | evidence → `{range: string}` expression (`'YYYY-MM-DD to YYYY-MM-DD'`, `'last 30 days'`) persisted verbatim · streamlit → ISO list | persisting the expression keeps relative presets rolling across reloads     | evidence — value is the range string; a small resolver expands it at predicate-build time                                                                                                                               |
| DateRange UI                  | evidence+streamlit → calendar grid in popover · framework → `Inputs.date` = native `<input type=date>`, no range                   | base-ui 1.8 has no calendar primitive; a correct aria grid is its own slice | Popover + two `type="date"` fields + preset row (subset of `PRESET_DEFINITIONS`); calendar grid deferred                                                                                                                |

## Gap analysis — what we already have vs the references

| Concern                    | Ours today (file)                                                                                               | Best reference (file)                                                                     | Gap                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Filter predicate shapes    | `src/web/src/features/filters/filter.ts` — `predicate()` emits `col = ?` / `col IN (...)` only                  | `evidence/.../slider/SliderFilter.svelte.ts` `predicateSql`, `range_calendar`             | partial — needs a per-input predicate builder                      |
| Column opt-out             | `src/web/src/features/filters/filters.ts` — `ensure` defaults `column` to the id; no "never predicate"          | `evidence/.../RangeCalendarFilter.svelte.ts` `queryOnly: !value_column`                   | partial — needs `column: false`                                    |
| `{{params.*}}` consumption | `src/web/src/features/pages/interpolate.ts` + `query-registry.tsx` (`useSearch` params; router-observed writes) | `evidence/.../Filter.svelte.ts` `templateValues` + `{{id}}` tokens                        | complete for raw-string use — no `{{id.between}}`-style properties |
| Select input core          | `src/web/src/features/widgets/inputs/{filter-select,option-items,select-fields,value-codec,types}.ts(x)`        | `evidence/.../dropdown/`                                                                  | complete for option-list inputs                                    |
| The five widgets           | absent — `markdown-page.tsx` `mdxComponents` maps only `Dropdown`/`MultiSelect` for inputs                      | per-repo inventory above                                                                  | absent                                                             |
| base-ui wraps              | `src/web/src/components/` has `combobox`, `accordion`, `collapsible`, `tabs`, `icons` only                      | `evidence/core/src/shadcn/components/ui/{slider,toggle-group,input,switch,popover,label}` | absent                                                             |
| Demo date column           | `src/web/scripts/generate-data.mjs` emits `order_id, week, region, amount`; `data/channels.csv`                 | `evidence/cli/test-environment/` datasets carry dates                                     | absent — DateRange needs `order_date`                              |

## Deviations

- Predicates bind `?` params, never text-interpolate (ADR-0005) — evidence's `escapeSqlValue`/`renderColumnPredicate` literal rendering is not ported.
- `{{params.id}}` binds the raw URL param; there are no `{{id.min}}`/`{{id.between}}` filter-property tokens — authors write the predicate position in SQL.
- Slider bounds reduce the named fence's rows in JS (`min`/`max` over `valueColumn`) rather than issuing a separate `select min(), max()` query as evidence does — same source-of-truth semantics as `<Dropdown>`'s option derivation.
- DateRange persists the range _expression_ in the URL (evidence semantics) but renders fields+presets instead of evidence's calendar grid; `custom_ranges`, `all_time_range`, `first_day_of_week` project settings are unported.
- TextInput commits debounced (~300ms) rather than per-keystroke as evidence does.
- Props stay camelCase (`valueColumn`, `initialValue`) matching SL-010; evidence's snake_case schema is not our MDX surface.
- Evidence `info`/`info_link`/`icon`/`width`/`flex`/`fmt`/`show_input`/`snap_to_step`/`max_height`/`order`/`orientation` props are out unless named in tasks.

## Open decisions

- DateRange preset set for the demo: proposed `Last 7 days` / `Last 30 days` / `Month to date` / `All time` — the resolver port covers exactly the listed keys plus absolute/partial ranges.
- Whether `column: false` also suppresses `Filters.ensure`'s `column ?? id` default for a bare consumer `ensure` — decide in T1's RED step; the lean is `false` survives (`false` is not nullish, so `?? id` leaves it).
- Toggle checked-vs-value display when `invert` is set — the lean is `checked = value XOR invert` so `?id=` always reads as emitted semantics.

## Surface

| Layer  | Files                                                                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| engine | none — the MDX map is client-side (`markdown-page.tsx`)                                                                                                                                                                                                                  |
| client | `src/web/src/features/filters/filter.ts` (+`filters.ts` only if `ensure` needs it), new `src/web/src/features/widgets/inputs/{slider,button-group,text-input,toggle,date-range}.tsx`, codecs/resolvers beside them, `types.ts` prop additions                            |
| ui     | `src/web/src/components/{slider,toggle-group,input,switch,popover}.tsx` wraps, `src/web/src/features/pages/markdown-page.tsx` `mdxComponents`, `pages/weekly-review.md`, `pages/nested/allocation.md`, `src/web/scripts/generate-data.mjs` + `data/orders.{csv,parquet}` |
| tests  | colocated `*.unit.test.ts(x)` + `*.stories.tsx` per widget, `src/web/src/features/filters/filter.unit.test.ts`, `test/e2e-browser/filter-inputs.spec.ts`, `test/integration/features/filter-inputs.feature` + `step_definitions`                                         |

## Tasks

One TDD unit each, one conventional commit each.

- [ ] T1 — `FilterOptions.predicate` builder + `column: false` opt-out in `filter.ts`; unit tests in `filter.unit.test.ts`/`filters.unit.test.ts`; no UI.
- [ ] T2 — `<Slider>`: `components/slider.tsx` base-ui wrap; `features/widgets/inputs/slider.tsx` + range codec (`"a - b"`/single number); `data`+`valueColumn` bounds via `useFilteredQueryRows` (fallback static `min`/`max`/`step`); `range` mode; `filters` cascade; clamp held value into bounds; `>=`/`BETWEEN` predicate via T1; `select-fields`-style label/`WidgetError` states. Stories + unit tests.
- [ ] T3 — `<ButtonGroup>`: `components/toggle-group.tsx` wrap; `button-group.tsx` reusing `option-items`/`selectValueCodec`/`selectFirst`/`multiple`/`filters`; `=`/`IN` predicate unchanged. Stories + unit tests.
- [ ] T4 — `<TextInput>` + `<Toggle>`: `components/input.tsx` + `components/switch.tsx` wraps; `text-input.tsx` (debounced commit, `placeholder`, `title`, `initialValue`, `column: false`), `toggle.tsx` (`label`, `invert`, `initialValue`, `column: false`); consumption demo via `{{params.id}}`. Stories + unit tests.
- [ ] T5 — `<DateRange>`: `components/popover.tsx` wrap; `date-range.tsx` — popover with two `type="date"` fields + preset list; `resolve-date-range.ts` subset port of `date-options.ts` (absolute `'X to Y'`, `from X`, `until Y`, `last N days`, the demo preset keys, `all time`); value = range string; `valueColumn`-gated `BETWEEN ? AND ?` predicate binding ISO params. Stories + unit tests.
- [ ] T6 — demo + data: `generate-data.mjs` emits `order_date` (per-order date inside its week); regen `data/orders.{csv,parquet}`; wire inputs into `pages/weekly-review.md` + `pages/nested/allocation.md`; extend `test/e2e-browser/filter-inputs.spec.ts` and `test/integration/features/filter-inputs.feature`; `playwright-cli` pass per `prompt-execution.md` §5.

## Out of scope

- Calendar-grid date picker (month grid, roving tabindex, aria grid roles) — deferred; the fields+presets UI carries evidence's value semantics.
- `custom_ranges`/`all_time_range`/`first_day_of_week` (evidence project-settings machinery), `default_range` labels naming custom ranges.
- `show_input` numeric fields beside the slider, `snap_to_step`, `fmt` readouts beyond the plain value, `orientation`/`max_height`/`order` on ButtonGroup.
- `{{id.*}}` filter-property template tokens (evidence `templateValues`) — `{{params.id}}` is the surface.
- `<FilterBar>` chips — SL-012; cross-filter `Coordinator`/`Selection` clauses — R2/SL-013.
- Number input, color/file/textarea inputs — not in this slice's ledger row.
