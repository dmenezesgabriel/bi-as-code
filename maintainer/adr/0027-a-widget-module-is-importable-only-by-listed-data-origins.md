# ADR-0027 — A widget module is importable cross-origin only by the origins `embed.dataOrigins` lists

Status: accepted
Date: 2026-10-24

## Context

`biac build` emits `build/widgets/<name>.js` ([ADR-0026](0026-an-export-is-declared-on-the-widget-tag.md)) for a page on another origin to import. Module scripts are fetched under the "JavaScript module security requirements" — a cross-origin `import` fails unless the module's response carries `Access-Control-Allow-Origin` granting the host page's origin (<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules>). `biac preview` sends CORS headers only on `/data/` ([ADR-0025](0025-data-files-are-readable-cross-origin-only-by-listed-origins.md)), so before this decision every cross-origin import was refused.

The module boots its own DuckDB-WASM against the publishing origin's `/data/` files (`src/web/src/features/widget-module/module-runtime.ts`), so whatever origin imports it must already be listed for its data reads.

## Decision drivers

- Deny by default, as data reads ([ADR-0025](0025-data-files-are-readable-cross-origin-only-by-listed-origins.md)) and framing ([ADR-0022](0022-framing-is-denied-unless-the-project-lists-the-origin.md)) are.
- One embedding relationship should be one grant: an origin that may mount a widget necessarily reads the files its query fetches.
- A grant that cannot render is a broken grant: an origin allowed to import the module but refused at `/data/` gets a chart that never draws.

## Options considered

| Option                                   | Pro                                                 | Con                                                                                                                                |
| ---------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Reuse `embed.dataOrigins`                | One list, one relationship; nothing new to learn    | The key's name reads as data-only though it covers the module import too                                                           |
| A sibling `embed.moduleOrigins`          | The import and the data reads are listed separately | Two grants that must be kept in lockstep — a `moduleOrigins` entry without the `dataOrigins` twin imports but never renders        |
| Reuse `embed.origins` (the framing list) | Already exists                                      | Framing is a different relationship — allowing a site to iframe pages also hands it the module and every raw file, and the reverse |

## Decision

`/widgets/` responses from `biac preview` carry the same grant `embed.dataOrigins` gives `/data/`: `dataCorsMiddleware` (`src/engine/data-cors.ts`) is mounted on both paths ahead of vite's preview middlewares, so a `304` keeps the headers exactly as on `/data/`. A listed origin's import is answered with `Access-Control-Allow-Origin: <origin>` and `Vary: Origin`; every other origin gets `Vary: Origin` only. `*` and credentials are never sent.

`biac dev` serves no `/widgets/` — the export is a build artifact — so it mounts nothing new.

## Consequences

- A host page on a listed origin imports the module and its queries reach `/data/`; an unlisted origin's `import()` rejects before any data flows.
- A static host that serves the build must send these headers for `widgets/*.js` itself, as it already must for `data/` ([ADR-0025](0025-data-files-are-readable-cross-origin-only-by-listed-origins.md)); any later server (`biac serve`, a bucket or CDN config) reuses `dataCorsHeaders`.
- The middleware's `/data/` extras — the `Range` preflight and the exposed range headers — ride on the module response too; a module's simple GET never preflights, so they are inert there.
- When a project exports several widgets, rolldown's shared runtime chunk lands under `widgets/` beside the entries ([ADR-0028](0028-an-exported-widget-module-bundles-its-runtime.md)), so the same mount covers it — no second grant is needed.
