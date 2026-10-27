# ADR-0026 — An exported widget is declared on its widget tag

Status: accepted
Date: 2026-10-22

## Context

`biac build` emits one ES module per exported widget under `build/widgets/`, for a page on another origin to import and mount. The module carries the widget's props, its query's SQL and the tables that query reads — the `WidgetSpec` the mount entry consumes (`src/web/src/features/widget-module/types.ts`). The build must therefore learn, from the project's sources, which widget on which page is exported and under what name. A widget's definition lives in a page: its props are the tag's attributes, and its query is one of the page's named ` ```sql ` fences (`src/engine/compile-page.ts` collects them into `sqlBlocks`). There is no standalone module file to point a config at — the exported artifact is derived from the page, not checked in beside it.

## Decision drivers

- The declaration cannot drift from the widget it declares: the exported module is the widget as its page renders it.
- One widget per module, and a page can carry several widgets — two of which may read one `data` block (the example dashboard's two `BigValue`s both read `totals`) — so the declaration must pin the exact tag, not a page plus a query name.
- The SPA's component props stay clean: the declaration is build configuration, not a prop a widget receives.
- A mistake fails the build at the tag, the way every other page rule fails (`src/engine/compile-page.ts`'s located compile errors).

## Options considered

| Option                                            | Pro                                                                      | Con                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `export="name"` on the widget tag, swept at build | Declaration sits with the props and query it exports; pins the exact tag | The site's exports are spread across pages; the sweep must strip the attribute so the SPA never sees it                                                                                                                                                                   |
| A list in `biac.config.ts` naming page and widget | Every export in one place; pages untouched                               | Must identify the widget inside the page — by `data` block name is ambiguous (two widgets can share one), by position is fragile as the page edits; the build still sweeps the page for the tag's props, so the config adds an indirection without removing any machinery |
| A standalone module file importing the widget     | The export is a checked-in artifact                                      | Cannot reach the page's sql fences without duplicating their SQL — the query would drift from the page's                                                                                                                                                                  |

## Decision

An author writes `export="name"` on the widget tag; `remarkWidgetExports` (`src/engine/widget-export-sweep.ts`) records the tag — name, widget, literal string props — into the compiled page and strips the attribute, and the build emits `build/widgets/<name>.js` (`src/engine/widget-exports.ts`). The sweep's rules, each a located compile error: the tag must be one the web's mount entry renders (`BarChart` today), the name lowercase kebab-case (one filename segment, so it cannot escape `build/widgets/`), every attribute a literal string (a computed value is not known at build), no `filters`/`select` (the module has no filter coordinator — crossfilter-bound exports are a later slice), and `data` naming a sql block on the page. A name declared by two pages fails the build naming both.

## Consequences

- Discovering a site's exports means grepping pages for `export="` — the build logs each emitted module's path, and a later slice can list them in the manifest if asked.
- The attribute is stripped before the compiled page carries props, so a widget's props type never sees it; the strip is why the SPA renders an exported widget exactly as an unexported one.
- The name is the module's URL — renaming an export changes the URL consumers import; the kebab-case rule keeps it a single safe path segment.
- An exported widget with a computed prop is refused rather than partially baked; the author writes the value literally.
