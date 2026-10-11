# SL-019 — A named SQL block renders nothing unless it asks to: `echo` shows its code, `display` shows its result table

Milestone: Phase 1 · State: in-progress · Depends on: SL-003, SL-004 · Closes: GAP-006

## Outcome

An author writes ` ```sql distance_bounds ` and the page shows nothing for it — the query still runs and feeds its widgets — while ` ```sql orders echo display ` shows the SQL and its result table, so helper queries stop flooding pages.

## Demo

1. Cold start: `bin/biac dev`, open `http://localhost:<port>/crossfilter-scale`.
2. No SQL code and no fence result table appear: the `distance_bounds` table ("Page 1 of 291 · 2901 rows") and the three 200,000-row tables ("Page 1 of 20000") are gone; `document.querySelectorAll("pre.shiki").length` is 0 (was 4 — Shiki replaces the `language-sql` class, so count `pre.shiki`).
3. The Distance slider still spans the full extent and dragging it re-filters the three histograms — hidden fences still run and feed widgets.
4. Open `/`: the `orders` fence shows exactly what its info string opts into (see T3), and the `<Table>`, `<Value>` and `<BarChart>` reading `orders` render unchanged.
5. Edit `pages/index.md`, change `orders` to `orders echo display`: after the hot update the SQL and its result table appear under it; remove `display`: only the code stays.
6. Change `data/orders.parquet` in `pages/index.md` front-matter to a missing file: the hidden `orders` fence still shows its inline error (`role="alert"`) — hiding never swallows a failure.
7. Write ` ```sql orders shwo `: the page shows the compile-error page naming `shwo` and the accepted attributes `echo`, `display`. Write ` ```sql echo `: the compile-error page says the name `echo` is an attribute — a flag in the name position never becomes a silently hidden block.
8. `bin/biac build` + `bin/biac preview`: steps 2–4 hold on the static build.

## Who else implements this

| Repo      | Has it  | Entry points                                                                                                                                                             | Approach in one line                                                                                                                                                                                                                                        |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| framework | FULL    | `research_repos/framework/src/sql.ts`, `research_repos/framework/src/markdown.ts`, `research_repos/framework/src/info.ts`                                                | Info string parsed as HTML-style attributes; `id=` fences default to `display=false` and every live fence defaults to `echo` off, so a named block shows nothing; bare `echo`/`display` opt in, `=false` opts out                                           |
| evidence  | PARTIAL | `research_repos/evidence/core/src/user-components/Renderer/MarkdocProcessor/process-markdoc.ts`, `research_repos/evidence/core/src/user-components/common/fence-meta.ts` | Fixed behavior, no option: `removeInlineQueries` strips every named sql fence from the render tree (neither code nor table); unnamed fences render code only. Its `docs/components/fence.mdx` does not describe this and is no evidence of display behavior |
| mosaic    | ABSENT  | `research_repos/mosaic/packages/vgplot/spec/src/parse-spec.js`                                                                                                           | A spec's `data:` definitions (`parseData`) are datasets, never rendered — hidden by construction, no opt-in to show them                                                                                                                                    |
| streamlit | ABSENT  | `research_repos/streamlit/lib/streamlit/connections/sql_connection.py`, `research_repos/streamlit/lib/streamlit/elements/code.py`                                        | Running a query (`SQLConnection.query`) renders nothing; showing code (`st.code`) or rows (`st.dataframe`) is a separate explicit call                                                                                                                      |

**Count:** 2 of 4 put named SQL blocks on a page at all, and **both hide a named block by default**; the other 2 never render a query unless asked. Today biac is the only one that always shows code and full result table. Build it, hidden by default (decided with the user when this PRD was written).

## Implementation inventory

### framework

| Concern                        | Files                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data model / schema            | `research_repos/framework/src/info.ts` — `Info {tag, attributes}`, `parseInfo` (HTML attribute tokenizer: bare `echo` → `""`, `echo=false`, quoted values)                                                                                 |
| Pipeline / execution           | `research_repos/framework/src/sql.ts` — `transpileSql`: `display` defaults to `"false"` when `id` is set, `""` (shown) when not; only the literal `"false"` hides                                                                          |
| Client / state                 | `research_repos/framework/src/sql.ts` — hidden: `const id = await sql…` (value bound, nothing displayed); shown: `display(Inputs.table(…))` then returns the value                                                                         |
| UI entry point                 | `research_repos/framework/src/markdown.ts` — `makeFenceRenderer`: `echo == null ? source == null : !isFalse(echo)` → live (sql) fences hide code unless `echo`; `isFalse` (case-insensitive `"false"`); `getLiveSource` routes `sql`       |
| Persistence of state           | none — the directives are static, in the page source                                                                                                                                                                                       |
| Empty / error / loading states | `research_repos/framework/src/markdown.ts` `makeFenceRenderer` — the `observablehq--block` placeholder is emitted whether or not `display` is set, so a hidden block's runtime error still renders in place; `SyntaxError` rendered inline |
| Accessibility specifics        | none specific to the directives                                                                                                                                                                                                            |
| Edge cases it handles          | `research_repos/framework/test/sql-test.ts` — `display` with no `id` is implicit (`"t"`, `"f"`, `"true"` all show), `display=false`, `id` + `display`; `research_repos/framework/test/info-test.ts` — quoting; `run=false` skips the cell  |
| Docs                           | `research_repos/framework/docs/sql.md` — "SQL code blocks": "When a SQL code block uses the `id` directive, the results are not displayed by default … add the `display` directive"                                                        |

### evidence

| Concern                        | Files                                                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data model / schema            | `research_repos/evidence/core/src/user-components/common/fence-meta.ts` — `FenceMeta {name, attrs, rest}`, `parseFenceMeta`: first token is the name, then `key=value` / quoted attrs; a leading `key=` means unnamed                                              |
| Pipeline / execution           | `research_repos/evidence/core/src/user-components/Renderer/MarkdocProcessor/replaceSqlFenceNodesWithInlineQueries.ts` — named sql fence → `inline_query` tag                                                                                                       |
| UI entry point                 | `research_repos/evidence/core/src/user-components/Renderer/MarkdocProcessor/process-markdoc.ts` — `isSqlFence` + `removeInlineQueries` (called at the end of the transform, after `registerInlineQueriesFromTree`)                                                 |
| Unnamed fence rendering        | `research_repos/evidence/core/src/user-components/nodes/fence/Fence.svelte`, `research_repos/evidence/core/src/user-components/nodes/fence/schema.ts` (reads `connection` from `parseFenceMeta(meta).attrs`)                                                       |
| Empty / error / loading states | errors surface where the query is consumed (the widget), and as validation errors — `validateNoNestedInlineQueries` in `process-markdoc.ts`                                                                                                                        |
| Edge cases it handles          | `research_repos/evidence/core/src/user-components/common/fence-meta.test.ts` — bare name, name + attrs, quoted values, extra whitespace, attrs without name, blank meta; `process-markdoc.svelte.spec.ts` — named fence inside a tab/accordion/details is an error |

**Disagreements the slice settles:**

| Axis                        | framework                              | evidence                                  |
| --------------------------- | -------------------------------------- | ----------------------------------------- |
| How a fence is named        | `id=top10` attribute                   | positional first token (` ```sql top10 `) |
| Attribute grammar           | HTML-style: bare flags and `key=value` | `key=value` only; bare words ignored      |
| Can the author show a block | yes — `echo` (code), `display` (table) | no — named blocks are always stripped     |
| Unknown attribute           | ignored                                | kept verbatim in `rest`                   |
| Error of a hidden block     | still rendered in place                | surfaces at the consuming widget          |

## Trade-offs and what we adopt

| Axis                      | Options seen (repo → approach)                                              | Trade-off                                                                                     | Our choice, and why                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default for a named fence | framework → hidden; evidence → hidden (stripped); biac today → code + table | Hidden changes every existing page; shown keeps flooding pages until each helper is annotated | **Hidden** — both references agree, and a page is a report, not a notebook. Decided with the user                                                        |
| Naming syntax             | framework → `id=`; evidence → positional                                    | Switching breaks every shipped page                                                           | **Positional** (evidence) — already shipped in `src/engine/compile-page.ts`                                                                              |
| Opt-in vocabulary         | framework → `echo` (code), `display` (table); evidence → none               | —                                                                                             | **`echo` and `display`** (framework), bare = on, `=false` = off, so an author coming from framework reads them unchanged                                 |
| Attribute grammar         | framework → HTML tokenizer; evidence → `key=value` regex                    | A full tokenizer handles quoting we have no attribute for                                     | Whitespace tokens after the name, each `flag` or `flag=true/false` — the two flags take no other values; port the name/attrs split of `parseFenceMeta`   |
| Unknown attribute         | framework → ignore; evidence → keep                                         | Ignoring turns a typo (`shwo`) into silently hidden output                                    | **Compile error** naming the token and the accepted set — the page-compile-error page already renders engine errors (`src/engine/page-compile-error.ts`) |
| Error of a hidden fence   | framework → rendered in place; evidence → at the consumer                   | A hidden fence with no consumer would otherwise fail silently                                 | **Rendered in place** (framework) — `TableError` shows even when `display` is off; keeps the "missing source" e2e contract                               |
| Loading of a hidden fence | framework → placeholder only when the cell is an expression                 | A skeleton for a hidden table is a layout jump for nothing                                    | Nothing while loading or on success when hidden                                                                                                          |

## Gap analysis — what we already have vs the references

| Concern                       | Ours today (file)                                                                                                                                                                            | Best reference (file)                                                        | Gap                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Info-string parsing           | `src/engine/compile-page.ts` `remarkPageMetadata` — the whole trimmed `node.meta` is the name; ` ```sql orders echo ` registers `"orders echo"`                                              | `research_repos/evidence/core/src/user-components/common/fence-meta.ts`      | **absent** — no name/attribute split                                     |
| Block model                   | `src/engine/types.ts` `SqlBlock {name, sql}`                                                                                                                                                 | `research_repos/framework/src/info.ts` `Info`                                | **complete** — stays `{name, sql}`: the flags are read only off `<code>` |
| Flags reaching the UI         | `src/engine/compile-page.ts` — only `meta: name` rides `hProperties` onto `<code>`                                                                                                           | `research_repos/framework/src/markdown.ts` `makeFenceRenderer`               | **absent**                                                               |
| Rendering                     | `src/web/src/features/pages/sql-block.tsx` `SqlBlockPre` — always `HighlightedPre` + `SqlResult` for a named fence                                                                           | `research_repos/framework/src/sql.ts` `transpileSql`                         | **absent** — no hide path (GAP-006)                                      |
| Error of hidden block         | `src/web/src/features/pages/sql-block.tsx` `SqlResult` → `TableError` (`src/web/src/features/widgets/table/states.tsx`)                                                                      | `research_repos/framework/src/markdown.ts` (placeholder always emitted)      | reusable — keep `TableError` reachable when hidden                       |
| Engine tests                  | `src/engine/compile-page.unit.test.ts` — `describe("sql blocks")`                                                                                                                            | `research_repos/evidence/core/src/user-components/common/fence-meta.test.ts` | partial — names covered, attributes absent                               |
| UI tests / stories            | `src/web/src/features/pages/sql-block.unit.test.tsx`, `src/web/src/features/pages/sql-block.stories.tsx` (Success, Loading, QueryError, Empty, UnnamedFence)                                 | —                                                                            | partial — no hidden/echo/display states                                  |
| Example pages                 | `pages/crossfilter-scale.md` (4 helper fences), `pages/weekly-review.md` (8), `pages/index.md` (1), `pages/nested/allocation.md` (1)                                                         | —                                                                            | every fence's visible output changes with the default                    |
| e2e contracts on fence tables | `test/e2e-browser/sql-queries.spec.ts`, `chart-selections.spec.ts` ("Page 1 of 4 · 39 rows" counts), `dev-server.spec.ts`, `table-widget.spec.ts`, `filters.spec.ts`, `static-build.spec.ts` | —                                                                            | counts include fence tables and must be re-derived                       |

Our implementation is **absent**. No ledger row claims `shipped` for display control; SL-003/SL-004 shipped the always-shown behavior this slice replaces.

## Deviations

- Positional name instead of framework's `id=`: kept for compatibility with every shipped page; stated in the ADR.
- An unknown fence attribute is a compile error, where both references are lenient: a typo must not silently hide output.

## Open decisions

None blocking. The default was settled with the user (hidden). T4 records it as an ADR (next free number; `AGENTS.md` reserves 0011 for vertical slices).

## Surface

| Layer  | Files                                                                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | `src/engine/compile-page.ts` (`registerSqlBlock`), `src/engine/sql-fence-meta.ts` (`parseSqlFenceMeta`)                                                                                                                     |
| client | `src/web/src/features/pages/sql-block.tsx` (reads `echo`/`display` props off the `<code>` child)                                                                                                                            |
| ui     | `src/web/src/features/pages/sql-block.tsx`, `src/web/src/features/pages/sql-block.stories.tsx`                                                                                                                              |
| pages  | `pages/crossfilter-scale.md`, `pages/weekly-review.md`, `pages/index.md`, `pages/nested/allocation.md`                                                                                                                      |
| tests  | `src/engine/compile-page.unit.test.ts`, `src/web/src/features/pages/sql-block.unit.test.tsx`, `test/e2e-browser/sql-queries.spec.ts`, `test/e2e-browser/crossfilter-scale.spec.ts`, specs counting fence tables (gap table) |

## Tasks

- [x] T1 — engine: split a sql fence's meta into `name` + `echo`/`display` booleans (bare or `=true` → on, `=false` → off, absent → off); any other token → compile error naming the token and the accepted `echo`, `display`; a flag or `key=` token in the name position → compile error. `SqlBlock` stays `{name, sql}` (nothing reads flags from `sqlBlocks`); the flags ride `hProperties` onto `<code>` beside `meta: name` as HTML boolean attributes — `echo=""`/`display=""` when on, absent when off (the `<code>` reaches the DOM before highlighting, and React rejects `true` on a non-boolean attribute), so T2 tests `props.echo !== undefined`. Unit tests: name only, each flag, both, `=false`, extra whitespace, unknown token, duplicate-name detection still on the bare name. Read `fence-meta.ts`/`fence-meta.test.ts` (evidence) and `info.ts`/`info-test.ts` (framework) first. `playwright-cli`: ` ```sql orders echo ` on `/` still renders today's output (the web does not read the flags yet).
- [x] T2 — web: `SqlBlockPre` renders `HighlightedPre` only with `echo`, the result table only with `display`, and `TableError` whenever the query fails; nothing otherwise. Same commit: add `echo display` to every fence in `pages/` so visible output is unchanged and e2e stays green. Unit tests + stories `Hidden`, `EchoOnly`, `DisplayOnly`, `EchoAndDisplay`, `HiddenError`. `playwright-cli` on `/`, `/weekly-review`: same fence/table counts as before.
- [x] T3 — pages: remove the opt-ins from every fence a widget reads — all four in `pages/crossfilter-scale.md`, every `pages/weekly-review.md` fence but `region_share` (no widget reads it; it keeps `echo display` to show `{{orders}}` composition), `pages/nested/allocation.md` `channel_mix`; keep `echo` on `pages/index.md` `orders` (the page that shows authors the syntax). Re-derive the e2e counts in the gap table. `playwright-cli` on `/crossfilter-scale`: `pre.shiki` count 0 (was 4), no "Page 1 of 20000"/"Page 1 of 291", slider + brush still re-filter; re-measure and close GAP-006 in `docs/research/usability-audit.md`.
- [ ] T4 — ADR: hidden by default, `echo`/`display` vocabulary, positional name, unknown attribute is an error, errors render in place.

## Out of scope

- Unnamed ` ```sql ` fences: they stay code-only and unexecuted (framework runs them and shows a table; that is its own decision).
- `run=false`, evidence's `connection=`, framework's destructuring `id=[…]`.
- File-based queries (`queries/*.sql`).
