# biac — Architecture

An [arc42](https://arc42.org) description of the system. Sections 5, 6 and 8 are large enough to live in their own files under `docs/architecture/` once the corresponding components land.

This document and everything under `docs/adr/` are **durable**: they describe decisions and non-trivial knowledge, and they never link to the reference implementations the project was built by studying. Build evidence lives in `docs/slices/` and is deleted when its slice ships — see [ADR-0001](adr/0001-record-architecture-decisions.md).

| Section                               | Where                                                              |
| ------------------------------------- | ------------------------------------------------------------------ |
| 1–4, 9–11                             | this file                                                          |
| 5 Building blocks                     | [architecture/building-blocks.md](architecture/building-blocks.md) |
| 6 Runtime views                       | [architecture/runtime-views.md](architecture/runtime-views.md)     |
| 8 Cross-cutting concepts, 12 Glossary | [architecture/cross-cutting.md](architecture/cross-cutting.md)     |

---

## 1. Introduction and goals

biac is a **business-intelligence-as-code** tool: a report is a directory of markdown pages. Each page mixes prose, fenced ` ```sql name ` query blocks, and JSX widgets (`<BigValue data="orders"/>`, `<BarChart>`, `<Dropdown>`). Widgets render live query results and cross-filter each other — brushing a chart or picking values in a filter input re-queries every linked widget.

A user runs `biac dev` in a project directory: a dev server watches `pages/**/*.md`, hot-updates content edits in place ([ADR-0009](adr/0009-page-edits-hot-update-without-a-reload.md)), serves an in-browser page editor on `?edit` that only the dev server carries ([ADR-0010](adr/0010-page-authoring-is-dev-server-only.md)), and serves the app. `biac build` emits a fully static site; `biac preview` serves it ([ADR-0008](adr/0008-static-build-is-a-spa-folder.md), [ADR-0029](adr/0029-the-build-copies-its-shell-per-route-and-honors-an-absolute-base.md)). There is no runtime backend — SQL executes in the browser via DuckDB-WASM ([ADR-0005](adr/0005-queries-run-client-side-in-duckdb-wasm.md)).

### Quality goals

| Goal                        | What it means here                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Authoring fidelity**      | What the markdown says is what renders — the page pipeline reads the file's own structure, never a screen approximation |
| **Interaction performance** | Cross-filtered re-query stays interactive on real data volumes — measured per slice, never eyeballed                    |
| **Static deployability**    | A built report works on any static host with no service                                                                 |
| **Polish**                  | A developer-facing tool that sits beside an editor all day: dense, quiet, keyboard-complete, accessible                 |

### Out of scope

Mobile and native clients · authentication and sharing · cloud hosting · collaboration/presence · a visual drag-and-drop report builder.

---

## 2. Constraints

### Technical

- **TypeScript strict**, Node 24, pnpm workspace. React 19 + TanStack Router + Tailwind 4 in `src/web/`; node-side pipeline in `src/engine/` and `src/cli/`.
- **No invention.** A capability present in a studied implementation is ported; one present in none is flagged as invention and justified. Cross-filtering ports the coordinator/selection/clause model natively ([ADR-0004](adr/0004-cross-filter-is-ported-from-the-mosaic-architecture.md)).
- **Client-side SQL only** — `@duckdb/duckdb-wasm` in the browser ([ADR-0005](adr/0005-queries-run-client-side-in-duckdb-wasm.md)).
- **Strict test-first development** with a full gate per slice ([ADR-0003](adr/0003-strict-tdd-with-a-per-slice-gate.md)).
- **Vertical slices only** ([ADR-0002](adr/0002-vertical-slices.md)).

### Tooling and gates

Vitest projects (unit / web-unit / integration / e2e) · Testing Library · Playwright · Cucumber · Storybook · Stryker mutation · ESLint (sonarjs, react-doctor) · Stylelint · Prettier · knip · dependency-cruiser · jscpd · fallow.

### Dependency policy

Three categories only: development tooling, the frameworks the application runs on, and the libraries the required stack mandates — each wrapped behind a thin interface whose boundary is dep-cruise-enforced (`.dependency-cruiser.cjs`). Install scripts are blocked by default with a documented allowlist in `pnpm-workspace.yaml`.

---

## 3. Context and scope

````
author → pages/*.md ──> biac dev ──> vite (dev) ──> browser SPA
                        biac build ──> <project>/build/ (SPA shell copied per route + 404.html + data/ + widgets/)
                        biac preview ──> static server

browser SPA: page module (compiled MDX) ──> widget registry
             ```sql blocks ──> named query registry ──> duckdb-wasm ──> data/ files
             inputs/charts ──> selections ──> coordinator ──> predicates ──> re-query
````

---

## 4. Solution strategy

| Force                                 | Approach                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Markdown pages must produce React     | `@mdx-js/mdx` compile at build/dev time inside a vite plugin in `src/engine/`; remark plugins extract ` ```sql name ` blocks and front-matter into a page manifest |
| Widgets need query results            | Named queries resolve through a page-scoped registry; `data="name"` string refs; `{{param}}` interpolation inside prop strings                                     |
| Filtering must compose across widgets | Coordinator + typed selections port ([ADR-0004](adr/0004-cross-filter-is-ported-from-the-mosaic-architecture.md)); `filters=[...]` wiring on widgets               |
| Filter state must be shareable        | Filter values persist in URL search params via `history.replaceState`                                                                                              |
| The wasm engine is a scoped resource  | Effect `Layer` owns connection lifecycle in `features/data/`                                                                                                       |
| Charts need selection gestures        | ECharts wrapped behind `features/widgets/charts/`; brush/click/legend events mapped to selection clauses                                                           |

## 9–11. Architecture decisions, quality, risks

Decisions live in [`adr/`](adr/). Risks and tracked debt live in [`backlog.md` § Known debt](backlog.md).
