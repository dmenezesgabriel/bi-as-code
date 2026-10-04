# 5. Building blocks

Grows as slices land. Each block is named for its component in `src/`; a block is documented when its boundary is stable.

## Level 1

| Block         | Where   | Responsibility                                                                       |
| ------------- | ------- | ------------------------------------------------------------------------------------ |
| `src/cli/`    | node    | `biac dev\|build\|preview` command surface; composition root (`main.ts`)             |
| `src/engine/` | node    | Page discovery, MDX/remark pipeline, front-matter schema, page manifest, vite plugin |
| `src/web/`    | browser | The SPA: page renderer, widget registry, filters, cross-filter, duckdb-wasm data     |

## Level 2 — `src/web/src/features/`

| Block          | Responsibility                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `pages/`       | Compiled-page mounting, MDXProvider component map, shiki-wrapped fences, front-matter application           |
| `widgets/`     | The widget catalog: `charts/` (echarts wrapper + marks), `inputs/` (filter widgets), `markdown/`, KPI/table |
| `filters/`     | Filter model: named values, URL persistence, `filters=[...]` wiring                                         |
| `crossfilter/` | Coordinator, Selection, clauses — the cross-filter substrate every data widget subscribes to                |
| `data/`        | duckdb-wasm connector (Effect layer), table registration, query service, Arrow handling                     |
| `editor/`      | CodeMirror editor surface (later milestone)                                                                 |
