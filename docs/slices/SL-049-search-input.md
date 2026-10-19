# SL-049 — A search box bound to a column filters the widgets that name it

Milestone: Phase 5 — Query files, translations, search · State: open · Depends on: — · Closes: GAP-050

> Delete this file when the slice ships. Every path below was verified on disk on 2026-10-19 (`test -e`). Observable Inputs' `search.js` is not on disk (framework re-exports the npm package); it was read on 2026-10-19 from https://raw.githubusercontent.com/observablehq/inputs/main/src/search.js.

## Outcome

An author writes `<Search id="q" column="region" data="order_amounts" />` and lists `q` in a widget's `filters`; typing narrows that widget with no hand-written SQL, the box states how many rows match, and `?q=` restores the query on reload.

## Demo

1. Cold start: `bin/biac dev`, open `/weekly-review`. The filter bar shows a search box labelled "Search regions" in place of today's `<TextInput id="q">`.
2. Before figures: see Baseline below (today's `TextInput` + hand-written `ilike` fence). After: the same row counts for the same typed text, with the `{{params.q}}` line gone from the `order_detail` fence in `pages/weekly-review.md`.
3. Type `we` — after the debounce the `order_detail` table narrows to rows whose region contains "we" (case-insensitive), the box reads "N matches", the URL carries `?q=we`.
4. Type `zzz` — the table shows its empty state and the box reads "No matches"; a screen reader hears the count change (`aria-live="polite"`).
5. Reload — the box holds `we`, the table is narrowed, the count is back.
6. Clear the box — `?q=` leaves the URL, every row returns, the filter bar's active count drops by one.
7. `bin/biac build && bin/biac preview` — steps 3–6 behave the same in the built site.

### Baseline

Measured 2026-10-19 with `playwright-cli` on `bin/biac dev`, on `/weekly-review` with today's `<TextInput id="q">` + `ilike` fence, before the page or the widget registry changed. The `order_detail` readout is the table's `· N rows` footer; at zero rows the table is replaced by a `0 rows` line:

| Reading                                        | Value |
| ---------------------------------------------- | ----- |
| `order_detail` table rows, empty `q`           | 355   |
| `order_detail` table rows, `q=we`              | 140   |
| `order_detail` table rows, `q=zzz`             | 0     |
| Visible match count beside the box             | none  |
| `?q=` after typing `we`                        | `we`  |
| Console errors / warnings after the three runs | 0 / 0 |

## Who else implements this

| Repo      | Has it  | Entry points                                                                                                                                                                      | Approach in one line                                                                                                                                                                                          |
| --------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | PARTIAL | `research_repos/evidence/core/src/user-components/tags/text_input/TextInputFilter.svelte.ts`, `research_repos/evidence/core/src/user-components/tags/text_input/TextInput.svelte` | A value-only text filter: its `sql` getter returns `undefined`, the author writes `WHERE name ILIKE '%{{search}}%'` with a pre-escaped value — the shape our `<TextInput>` has today                          |
| framework | FULL    | `research_repos/framework/docs/inputs/search.md`, `research_repos/framework/src/client/stdlib/inputs.js` (re-exports `search`, `searchFilter` from `@observablehq/inputs`)        | `Inputs.search(data, {columns, …})` filters an in-memory array: query split on whitespace, each term prefix-matched at a word start, case-insensitive, AND across terms, OR across columns; shows "N results" |
| mosaic    | FULL    | `research_repos/mosaic/packages/vgplot/inputs/src/Search.js`, `research_repos/mosaic/packages/mosaic/core/src/clause/MatchClause.ts`                                              | `Search({as, field, type})` publishes `clauseMatch(field, value, {method})` into a Selection on every `input` event; empty text → null predicate; optional `from`+`column` `<datalist>` autocomplete          |
| streamlit | PARTIAL | `research_repos/streamlit/lib/streamlit/elements/widgets/text_widgets.py`, `research_repos/streamlit/frontend/lib/src/components/widgets/TextInput/TextInput.tsx`                 | `st.text_input` returns a string the script uses; `st.dataframe`'s toolbar search (`research_repos/streamlit/frontend/lib/src/components/widgets/DataFrame/DataFrame.tsx`) is grid-local, never a filter      |

**Count:** 2 of 4 implement a search that filters (framework, mosaic); the other 2 stop at a value the author wires by hand — exactly GAP-050. Worth building.

## Implementation inventory

### framework (Observable Inputs)

| Concern                        | Files                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model / schema            | `research_repos/framework/docs/inputs/search.md` § Options (`label`, `query`, `placeholder` default "Search", `columns`, `format`, `filter`, `datalist`, `required`)                           |
| Pipeline / execution           | upstream `src/search.js` `searchFilter`, `columnFilter`, `termFilter` (`new RegExp("(?:^\|[^\\p{L}-])" + escaped term, "iu")`) — client-side `Array.filter`, no SQL                            |
| Client / state                 | upstream `src/search.js` `oninput` recomputes `value` on every keystroke, no debounce; `required: true` makes an empty query mean every row                                                    |
| UI entry point                 | `research_repos/framework/src/client/stdlib/inputs.js`                                                                                                                                         |
| Persistence of state           | none — the value lives in the page's reactive runtime, not the URL                                                                                                                             |
| Empty / error / loading states | upstream `src/search.js` `formatResults` → `"0 results"` / `"1 result"` / `"N results"` in an `<output>` beside the field                                                                      |
| Accessibility specifics        | upstream `src/search.js` — `<input type=search>` (implicit `searchbox` role), `<output>` for the count (implicit `status` role, polite live region), `submit` prevented so Enter never reloads |
| Edge cases it handles          | regex metacharacters escaped; `null` rows never match; terms match only at a word start ("gen" matches "Gentoo", not "oxygen")                                                                 |

### mosaic

| Concern                        | Files                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model / schema            | `research_repos/mosaic/packages/vgplot/inputs/src/Search.js` constructor options (`as`, `field` defaulting to `column`, `type` `contains`\|`prefix`\|`suffix`\|`regexp`, `from`, `label`)   |
| Pipeline / execution           | `research_repos/mosaic/packages/mosaic/core/src/clause/MatchClause.ts` `clauseMatch` (one field, lowered both sides unless `caseSensitive`), `clauseMatchAny` (OR over several fields)      |
| Client / state                 | `research_repos/mosaic/packages/vgplot/inputs/src/Search.js` `publish` — Selection gets a clause, a plain Param gets the string; `activate` on focus/pointerenter for cross-filter prefetch |
| UI entry point                 | `research_repos/mosaic/packages/vgplot/inputs/src/Search.js` `search(options)`                                                                                                              |
| Persistence of state           | none                                                                                                                                                                                        |
| Empty / error / loading states | `research_repos/mosaic/packages/mosaic/core/src/clause/MatchClause.ts` — empty value → `predicate: null` (clears); no count, no error face (a bad `regexp` surfaces as a query error)       |
| Accessibility specifics        | `research_repos/mosaic/packages/vgplot/inputs/src/Search.js` — `<label for>` bound to the box; `type="text"`, placeholder "Query"                                                           |
| Edge cases it handles          | `research_repos/mosaic/packages/vgplot/inputs/src/Search.js` `query`/`update` — `<datalist>` of distinct `column` values from `from`, itself filtered by `filterBy`                         |

### evidence and streamlit (value-only, read for the field's behaviour)

| Concern         | Files                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| URL persistence | `research_repos/evidence/core/src/user-components/tags/text_input/TextInputFilter.svelte.ts` (`serialize` drops `""`, `deserialize` identity) |
| Field props     | `research_repos/evidence/core/src/user-components/tags/text_input/schema.ts`                                                                  |
| Empty / a11y    | `research_repos/streamlit/lib/streamlit/elements/widgets/text_widgets.py` (`placeholder`, `max_chars`, `label_visibility`)                    |
| Commit timing   | `research_repos/streamlit/frontend/lib/src/components/widgets/TextInput/TextInput.tsx` (commits on Enter/blur, not per keystroke)             |

**Where they disagree:** match semantics (framework per-term word-prefix AND across all columns; mosaic one field, one method); commit timing (framework and mosaic per keystroke; streamlit on Enter/blur; ours debounced 300 ms); count (framework shows it; mosaic does not). Each is a row below.

## Trade-offs and what we adopt

| Axis            | Options seen (repo → approach)                                                                               | Trade-off                                                                                                                                                                    | Our choice, and why                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Match semantics | framework → per-term word-prefix, AND, any column; mosaic → one field, `contains`/`prefix`/`suffix`/`regexp` | framework's needs a term parser and a multi-column OR per term; mosaic's is one predicate and already ported (`clauseMatch` in `src/web/src/features/crossfilter/clause.ts`) | mosaic: one `column`, `method` `contains` (default) \| `prefix` \| `suffix`. The backlog row says "bound to a column"; multi-column is Out of scope                                                   |
| `regexp` method | mosaic → offered                                                                                             | An unfinished pattern (`[a`) is a DuckDB error on every widget the filter names, mid-typing                                                                                  | Not offered: `method` accepts the three safe values; a typo is a located error at compile like other bad props                                                                                        |
| Case            | both → case-insensitive by default                                                                           | —                                                                                                                                                                            | Case-insensitive, `clauseMatch`'s default; no `caseSensitive` prop                                                                                                                                    |
| Commit timing   | framework, mosaic → per keystroke; streamlit → Enter/blur                                                    | Per keystroke re-queries every filtered widget on each key; Enter-only hides the live narrowing                                                                              | Ours already: 300 ms debounce plus Enter/blur (`src/web/src/features/widgets/inputs/text-input.tsx` `COMMIT_DEBOUNCE_MS`). Share it, don't copy it                                                    |
| Match count     | framework → "N results" in `<output>`; mosaic → none                                                         | A count needs a row source; framework has its array, ours needs a query                                                                                                      | Shown when `data` is given: rows of that fence under every filter it names plus the search itself, via `useFilteredQueryRows` (`src/web/src/features/filters/use-filtered-query-rows.ts`); `<output>` |
| Field element   | framework → `type=search`; mosaic → `type=text`                                                              | `type=search` gives the `searchbox` role and a native clear button in Chromium                                                                                               | `type="search"`                                                                                                                                                                                       |
| URL persistence | evidence → `?id=` with `""` dropped; framework, mosaic → none                                                | —                                                                                                                                                                            | evidence's, which `Filter` (`src/web/src/features/filters/filter.ts`) already implements                                                                                                              |
| Autocomplete    | mosaic → `<datalist>` from `from`+`column`; framework → `datalist` option                                    | A second query per page load for a hint list                                                                                                                                 | Out of scope                                                                                                                                                                                          |

## Gap analysis — what we already have vs the references

| Concern                    | Ours today (file)                                                                                                                                            | Best reference (file)                                                  | Gap                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------- |
| Match clause               | `src/web/src/features/crossfilter/clause.ts` `clauseMatch` — bound `?`, lowered, four methods; only `clause.unit.test.ts` calls it                           | `research_repos/mosaic/packages/mosaic/core/src/clause/MatchClause.ts` | complete but unreachable          |
| Clause factory on a filter | `src/web/src/features/filters/filter.ts` `FilterOptions.clause`; precedent `sliderClause` in `src/web/src/features/widgets/inputs/slider-value.ts`           | `research_repos/mosaic/packages/vgplot/inputs/src/Search.js` `clause`  | complete — the seam to plug into  |
| Text field                 | `src/web/src/features/widgets/inputs/text-input.tsx` — draft state, 300 ms debounce, Enter/blur commit, `column: false`                                      | `research_repos/mosaic/packages/vgplot/inputs/src/Search.js`           | partial — field yes, predicate no |
| Widget                     | none                                                                                                                                                         | `research_repos/mosaic/packages/vgplot/inputs/src/Search.js`           | absent                            |
| Props                      | `src/web/src/features/widgets/inputs/types.ts` — `TextInputProps` only                                                                                       | `research_repos/framework/docs/inputs/search.md` § Options             | absent                            |
| Tag registry               | `src/web/src/features/pages/markdown-page.tsx` component map; `src/engine/reserved-filter-id.ts` `FILTER_INPUT_TAGS` ("a new input belongs in both places")  | —                                                                      | absent                            |
| Match count                | `src/web/src/features/filters/use-filtered-query-rows.ts` exists; no consumer counts                                                                         | upstream Observable Inputs `src/search.js` `formatResults`             | absent                            |
| Example page               | `pages/weekly-review.md` — `<TextInput id="q">` + `where ({{params.q}} is null or region ilike '%' \|\| {{params.q}} \|\| '%')` in the `order_detail` fence  | —                                                                      | the GAP-050 symptom               |
| Tests on the example       | `test/e2e-browser/filter-inputs.spec.ts` "the q text input and large_orders toggle re-query order_detail"; `test/integration/features/filter-inputs.feature` | —                                                                      | change with the example page      |

Our implementation is **present but unreachable**: the clause and the filter seam exist, no widget publishes a match. Nothing in the ledger claims any part of it shipped.

## Deviations

- No `regexp` method (mosaic offers it) — stated in a code comment beside the `method` check.
- One column only (framework searches all columns) — stated in the widget's docstring.

## Open decisions

| Id  | Decision                                              | Evidence                                                                                                                                                                 | Recommendation                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O1  | Where `<TextInput>` lives once `q` becomes `<Search>` | `pages/weekly-review.md` is its only page; `test/e2e-browser/filter-inputs.spec.ts` drives it there                                                                      | **Settled (T1):** `<TextInput id="order" title="Order id">` on `pages/weekly-review.md`, consumed by `({{params.order}} is null or order_id::varchar = {{params.order}})` in `order_detail`; its browser test drives `order=42` + `large_orders` |
| O2  | Count wording                                         | upstream `formatResults` → "N results"; no widget under `src/web/src/features/widgets/` states a row count today (grep for `of ${` / `rows` in `table/*.tsx` finds none) | "N matches" / "1 match" / "No matches", number via `formatValue` in `src/web/src/features/widgets/value/format.ts`                                                                                                                               |

## Surface

| Layer  | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| engine | `src/engine/reserved-filter-id.ts` (`Search` in `FILTER_INPUT_TAGS`), `src/engine/search-method.ts` (a bad literal `method` fails the compile at its attribute)                                                                                                                                                                                                                                                                                        |
| client | `src/web/src/features/filters/use-filtered-query-rows.ts` (consumed, not changed), `src/web/src/features/crossfilter/clause.ts` (consumed)                                                                                                                                                                                                                                                                                                             |
| ui     | `src/web/src/features/widgets/inputs/search.tsx` (new) + `search.stories.tsx`, `src/web/src/features/widgets/inputs/search-clause.ts`, `src/web/src/features/widgets/inputs/use-text-draft.ts` + `src/web/src/features/widgets/inputs/draft-text-field.tsx` shared with `src/web/src/features/widgets/inputs/text-input.tsx`, `src/web/src/features/widgets/inputs/types.ts`, `src/web/src/features/pages/markdown-page.tsx`, `pages/weekly-review.md` |
| tests  | colocated `search.unit.test.tsx`, `src/engine/reserved-filter-id.unit.test.ts`, `test/integration/features/filter-inputs.feature`, `test/e2e-browser/filter-inputs.spec.ts`                                                                                                                                                                                                                                                                            |

## Tasks

- [x] T1 — `<Search id column method? title? placeholder? initialValue?>` publishes `clauseMatch` through `FilterOptions.clause`, persisted as `?id=`; the draft/debounce logic leaves `text-input.tsx` for a hook both widgets use; `Search` registered in `markdown-page.tsx` and `FILTER_INPUT_TAGS`; a bad `method` is a located error; stories (empty, held, disabled); `pages/weekly-review.md` replaces `<TextInput id="q">` + the `ilike` line with `<Search id="q" column="region">` and `q` in the `order_detail` table's `filters`; settle O1. playwright-cli: record Baseline first, then type/clear/reload on `/weekly-review`, rows and `?q=` against Baseline, console clean.
- [ ] T2 — The match count: with `data`, an `<output>` beside the box reads the count of that fence's rows under its filters and the search itself; stories for loading, counted, none and a bad `data` source (`source-error.tsx` pattern); e2e asserts the count follows typing and reload; settle O2. playwright-cli: count text and `role=status` after `we`, `zzz`, clear.

## Out of scope

- Searching several columns at once (`clauseMatchAny`, framework's all-columns default) — a later slice if asked.
- `regexp` matching and case-sensitive matching.
- Autocomplete suggestions (`<datalist>`).
- Search across pages — SL-052.
