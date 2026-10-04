# Backlog

**Start here.** This is the entry point for an execution session.

| Need                                     | Read                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| What to work on next                     | this file — the first row marked `open ← next`                                      |
| How to build it                          | `docs/slices/SL-NNN-*.md`, the PRD for that slice                                   |
| Which reference repos have a feature     | [`research/feature-census.md`](research/feature-census.md) — all 4, by feature area |
| What is shipped but not usable, measured | [`research/usability-audit.md`](research/usability-audit.md) — every `GAP-NNN`      |
| Starting a new PRD                       | copy [`slices/_TEMPLATE.md`](slices/_TEMPLATE.md)                                   |
| Why the system is shaped this way        | [`architecture.md`](architecture.md) and [`adr/`](adr/)                             |
| How a session runs                       | [`../prompt-execution.md`](../prompt-execution.md)                                  |

## Finding things — grep, don't read

Every doc is written to be grepped. Ids are unique tokens, facts sit on one line (paragraphs are not hard-wrapped; tables hold one fact per row), and file names are written in full.

| To find                               | Run                                                                |
| ------------------------------------- | ------------------------------------------------------------------ |
| Everything about one slice            | `grep -rn "SL-004" docs/`                                          |
| Everything about one decision         | `grep -rn "ADR-0001" docs/ src/`                                   |
| Every open usability gap              | `grep -o "GAP-[0-9]*" docs/research/usability-audit.md \| sort -u` |
| Every doc that mentions a source file | `grep -rn "page-loader.ts" docs/`                                  |
| What the references do for a feature  | `grep -n -i "dropdown" docs/research/*.md docs/slices/*.md`        |
| The next slice                        | `grep -n "\*\*open ← next" docs/backlog.md`                        |
| Unchecked tasks in a PRD              | `grep -n "\[ \]" docs/slices/SL-NNN-*.md`                          |

Id prefixes: `ADR-NNNN` decision · `SL-NNN` slice · `GAP-NNN` usability gap · `DEF-NNN` defect, race, leak or vulnerability · `R<n>` research session · `T<n>` task inside one PRD · `B<n>` bootstrap row.

## The rules

- A **slice** is one user-visible capability, crossing engine → client → UI. A slice is never cut horizontally; too large is fixed by narrowing the capability.
- A slice is `shipped` only after **a human has run its demo** in the real app. Otherwise it is `partial`, and its row names the missing entry point.
- **Passing gates do not make a slice usable.** A demo records its before and after measurements for anything it touches on screen.
- **Every session ends with a `playwright-cli` pass** over the running app — navigate the changed screens, snapshot, screenshot and read them, interact with the page, measure, keep `console` clean. Not optional, not delegated; details in `prompt-execution.md` §5.
- **Finish what we started.** No milestone opens while an earlier one has an `open` or `partial` slice.
- Gate results go in the **commit body**, never here. A row gets one line.
- Correct this file by **editing** it. Git holds the history. No dated correction blocks.
- A slice PRD is **written when the slice is picked up**, not in advance, and **deleted when it ships**. Evidence gathered early rots before it is used. Anything worth keeping becomes an ADR or a code comment first.
- A PRD's cross-repo research is a **fresh pass**, with every cited path verified on disk in the session that writes it.

### What a PRD owes the agent that executes it

The PRD exists so the next session **never guesses and never assumes**. Three sections are mandatory:

- **Who else implements this** — a row for **every one of the 4 feature reference repos** (`evidence`, `framework`, `mosaic`, `streamlit`), including those that do not have the feature. A capability present in most of them is probably worth having; one present in none is an invention and has to be justified. Start from [`research/feature-census.md`](research/feature-census.md), then verify.
- **Implementation inventory** — for every repo that has it, the actual files to open, grouped by concern. Not a summary of those files: the paths, so the executing agent reads the real code and picks what suits us. Where two repos disagree, that disagreement **is** the decision the slice has to make, and it is named.
- **Gap analysis** — our own code against the references for the same feature, file against file, stating plainly whether ours is absent, unreachable, partial, or complete.

---

## Phase 0 — Foundations · shipped

Scaffold and quality gates (B1–B5): pnpm workspace, vitest projects, playwright, cucumber, storybook, eslint/stylelint/prettier, knip, dep:cruise, jscpd, fallow, stryker, lint-staged, commitlint, husky; docs structure; `research_repos/` clones.

| Row   | Scope                                                                                                                                    | State   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| B1–B5 | Scaffold, gates, docs structure                                                                                                          | shipped |
| R1    | Feature census of `evidence`, `framework`, `mosaic`, `streamlit` → `docs/research/feature-census.md` + `docs/research/widget-catalog.md` | shipped |

## Phase 1 — A usable BI-as-code product

Phase 1 alone is a shippable product: `biac dev` serves markdown pages with live SQL widgets; filters and chart selections cross-filter them; `biac build` emits a static site.

| Id     | Slice                                                                                                                                                                                                            | State   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| SL-001 | `biac dev`: vite + pages plugin serves the SPA over `pages/**/*.md` — discovery, MDX compile (front-matter, gfm, shiki fences, sql-block extraction), page manifest → TanStack Router routes, hot reload on edit | shipped |
| SL-002 | Page chrome: sidebar nav tree, table of contents, breadcrumbs, light/dark theme, `biac.config.ts` (title/nav/theme)                                                                                              | shipped |
| SL-003 | duckdb-wasm data service (Effect layer): `sql:` front-matter + config table registration from parquet/csv/json/arrow, ` ```sql name ` → named query registry, Arrow results, `{{param}}` interpolation           | queued  |
| SL-004 | `<Table>`: sort, pagination, loading/error/empty states                                                                                                                                                          | queued  |
| SL-005 | `<BigValue>`/`<Value>`: fmt, delta, sparkline                                                                                                                                                                    | queued  |
| SL-006 | ECharts wrapper + `<BarChart>`/`<LineChart>`/`<AreaChart>` (series, stacking, labels)                                                                                                                            | queued  |
| SL-007 | `<ScatterChart>`/`<Histogram>`/`<Heatmap>`                                                                                                                                                                       | queued  |
| SL-008 | Markdown widgets: `<Callout>`/`<Details>`/`<Tabs>`/`<Accordion>`/`<Row>`/`<Stack>`                                                                                                                               | queued  |
| SL-009 | Filter model + URL persistence (evidence `Filter.svelte.ts` semantics port) + `filters=[...]` consumption by data widgets                                                                                        | queued  |
| SL-010 | `<Dropdown>` + `<MultiSelect>` with search                                                                                                                                                                       | queued  |
| SL-011 | `<Slider>`/`<DateRange>`/`<TextInput>`/`<ButtonGroup>`/`<Toggle>`                                                                                                                                                | queued  |
| SL-012 | `<FilterBar>`                                                                                                                                                                                                    | queued  |
| R2     | Interaction reference: measured cross-filter semantics from `mosaic` (resolution strategies, clause types, cross/empty, debounce) → `docs/research/interaction-reference.md`                                     | queued  |
| SL-013 | Cross-filter port: `Coordinator`, `Selection` (intersect/union/single), clauses (point/interval/list/match), publish→re-query per client, `cross` exclude-self                                                   | queued  |
| SL-014 | Chart-driven selections: brush interval + point click + legend → clauses; `select: crossfilter` + `filterBy` semantics                                                                                           | queued  |
| SL-015 | Cross-filter perf parity pass vs mosaic: debounce, query batching/consolidation decision                                                                                                                         | queued  |
| SL-016 | `biac build` static bundle (compiled pages + copied data files) + `biac preview` static server                                                                                                                   | queued  |
| SL-017 | CodeMirror page editor + dev-only save endpoint + live preview                                                                                                                                                   | queued  |
| R3     | Usability audit of shipped rows → `docs/research/usability-audit.md` (`GAP-NNN`s)                                                                                                                                | queued  |

## Later phases

Not started. Nothing here begins until the Phase 1 exit demo passes.

| Phase                      | Contents                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Connectors**             | remote DuckDB/MotherDuck/PostgreSQL sources (evidence `core/src/connectors/`, `mosaic-duckdb` data-server)                     |
| **Data loaders**           | framework's `name.ext.js` loader model — arbitrary programs generating data files at build/watch                               |
| **Chart parity remainder** | pie, funnel, sankey, treemap, candlestick, radar, polar, map, calendar heatmap, combo, waterfall, reference lines/areas/points |
| **Table extras**           | download, column filters, column config, pivot                                                                                 |
| **Templating**             | `<If>`/`<Repeat>` blocks, `<Partial>` includes, component docs site                                                            |
| **Platform**               | search, print/PDF, theming beyond light/dark, i18n, dimension grid, query console, custom components                           |

## Known debt

Tracked, not fixed silently. Each is closed by a slice, not by a drive-by edit.

| Debt                                                                                               | Where                         | Closed by                                |
| -------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------- |
| GHSA-vfj7-8cjw-p6xm (braces ≤3.0.3, via commitizen) accepted — no patched release exists, dev-only | `pnpm-workspace.yaml` comment | First upstream release with a fix        |
| `MDX` expression refs (`data={orders}`) unsupported — v1 is string refs only (`data="name"`)       | page pipeline                 | Recma scope-injection slice, if demanded |
