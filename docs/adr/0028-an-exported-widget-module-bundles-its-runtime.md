# ADR-0028 — An exported widget module bundles its whole runtime

Status: accepted
Date: 2026-10-24

## Context

`build/widgets/<name>.js` is a vite library-mode build of the mount entry (`src/cli/commands/build.ts` `buildWidgetModules`): React, the widget, ECharts, the DuckDB-WASM client glue, and — inlined by lib mode as `data:` URLs — the wasm bundles and worker scripts the runtime boots from. The question is what may stay out of that file and live elsewhere: beside it as chunks, or on the host as externals.

Measured on `revenue-by-region.js` (2026-10-24):

| Variant                                      | Size          | Composition                                                                               |
| -------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| All-in-one (as built)                        | 101,891,606 B | `data:` payloads 100,296,860 B (98.43%); JS+CSS 1,594,746 B (1.57%); gzip 25,349,462      |
| `react`, `react-dom`, `echarts` externalized | 100,721,123 B | −1,170,483 B (−1.15%) — nearly all of it is the wasm either way                           |
| Two exports on one build                     | —             | shared runtime chunk `widgets/module-runtime-<hash>.js` 101,891,010 B + two 316 B entries |

## Decision drivers

- The host page's contract is one `import` — no import map, no pinned dependency list to keep in step with ours.
- The inlined assets dominate the bytes; the JS share is what externals could shave.
- The wasm and worker riding inside the module is what keeps the CORS grant at the file itself ([ADR-0027](0027-a-widget-module-is-importable-only-by-listed-data-origins.md)) — asset URLs would need their own.

## Options considered

| Option                                     | Pro                                         | Con                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| All-in-one per module                      | One import, nothing for the host to provide | A 102 MB module; two exports of one project duplicate the runtime unless the bundler shares it (it does — see Decision)                         |
| Shared chunks beside the module            | Sibling exports pay the runtime cost once   | Already happens: rolldown emits `widgets/<name>-<hash>.js` for common code between entries; it is covered by the `/widgets/` grant              |
| `react`/`react-dom`/`echarts` as externals | −1.15% of the module                        | A bare `import "react"` resolves only if the host supplies an import map at our pinned versions — a second interface, and the saving is noise   |
| Reuse the SPA's own chunks                 | Would share code with the site              | Not importable: `build/assets/index-<hash>.js` is a separate build's hashed app graph — an entry that executes the SPA, with no export contract |

## Decision

Each export bundles its whole runtime — all-in-one is the shipping shape, and the single-import contract is the point of the export. Rolldown's own chunk sharing between sibling entries stays on (their chunks emit under `widgets/`, inside the same grant); nothing is externalized onto the host.

## Consequences

- A host page needs exactly one URL; no import map, no dependency versions to coordinate.
- The 102 MB is ~98% the two duckdb bundles (mvp + eh) and their workers inlined as `data:` URLs — a browser parses all of it at import. gzip brings the wire cost to ~25 MB; the parse cost stays. Shrinking it means shipping the wasm as files under their own grant — a different decision, not this one.
- A project exporting several widgets pays the runtime once per shared chunk, not once per export.
