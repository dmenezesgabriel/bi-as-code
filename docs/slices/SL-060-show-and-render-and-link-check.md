# SL-060 — A widget's markup is shown as source and rendered from one copy, and `biac build` fails on a broken internal link

Milestone: Phase 8 — Documentation site · State: open · Depends on: — · Closes: GAP-065, GAP-066

## Outcome

An author writes a widget's markup once in a page and readers see both the live widget and the exact markup that produced it; an author who links to a page that does not exist gets a failed `biac build` that names the page file, the line and the target.

## Demo

1. Cold start: `bin/biac dev`, open the example page that carries a show-and-render snippet (added in T1).
2. The snippet's widget renders live on real data, and the markup that produced it is shown highlighted beside it — one copy in the page file.
3. Edit the markup in the snippet (e.g. change `x=` on a chart) and save — the live widget and the shown source both change.
4. Add `[gone](/no-such-page)` to any page, stop the dev server and run `bin/biac build` — it exits non-zero and prints `pages/<file>.md:<line>` and `/no-such-page`; no `build/` is half-written.
5. Remove the link and run `bin/biac build` again — it passes.

## Who else implements this

Two capabilities; each repo gets a row for both.

### Show and render one snippet (GAP-065)

| Repo      | Has it  | Entry points                                                                                                                                        | Approach in one line                                                                                                                                                                        |
| --------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| framework | FULL    | `framework/src/markdown.ts`, `framework/docs/javascript.md`, `framework/docs/jsx.md`                                                                | A ` ```js ` / ` ```jsx ` fence runs by default; the `echo` attribute also shows its code, `run=false` shows it without running; the rendered output is emitted first, then the code         |
| mosaic    | PARTIAL | `mosaic/docs/examples/aeromagnetic-survey.md`, `mosaic/docs/.vitepress/theme/Example.vue`, `mosaic/docs/public/specs/yaml/aeromagnetic-survey.yaml` | One spec file referenced twice: `<Example spec="/specs/yaml/….yaml" />` renders it, VitePress's `<<< @/public/specs/…` include shows it under a "Specification" heading — docs tooling only |
| evidence  | ABSENT  | `evidence/core/src/user-components/nodes/link/schema.ts` (`examples`), `evidence/cli/src/lib/docs/index.ts`                                         | Each tag schema carries `examples: [{ title, example }]` as source strings, served to agents by the docs API and never rendered                                                             |
| streamlit | FULL    | `streamlit/lib/streamlit/commands/echo.py`, `streamlit/lib/tests/streamlit/elements/echo_test.py`, `streamlit/lib/tests/streamlit/echo_test_data/`  | `with st.echo(code_location="above"\|"below"):` reads the block's own source from the script file via `ast`, runs it, and shows it above (default) or below the output                      |

**Count:** 3 of 4 (2 FULL). Every product that documents itself with itself does this; it is worth building.

### Broken internal-link check (GAP-066)

| Repo      | Has it            | Entry points                                                                                                                                                                                                                  | Approach in one line                                                                                                                                                                                                                                                                 |
| --------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| framework | PARTIAL           | `framework/src/build.ts` (`validateLinks`), `framework/src/html.ts` (`findAssets`), `framework/src/resolvers.ts`, `framework/test/build-test.ts`, `framework/test/html-test.ts`                                               | After the build, every `a[href]` of every rendered page is resolved against the page path and checked against page paths and `page#anchor` ids; the build **warns** "N broken links (M validated)" and lists `path → link` — a source comment reads "TODO Have this break the build" |
| mosaic    | PARTIAL           | `mosaic/docs/.vitepress/config.js`                                                                                                                                                                                            | VitePress fails the build on dead links by default (`ignoreDeadLinks` default `false`, https://vitepress.dev/reference/site-config#ignoredeadlinks); mosaic's config does not set it — tooling, not product                                                                          |
| evidence  | FULL              | `evidence/core/src/user-components/validators/isTreePath.ts`, `evidence/core/src/user-components/nodes/link/schema.ts`, `evidence/core/src/user-components/common/transform-internal-link.ts`, `evidence/cli/cli/validate.ts` | Each markdown link's `href` is walked segment by segment through the project tree; an unknown segment or a path ending at a folder is an `error`-level `invalid-link-href` naming the segment, at the node's location                                                                |
| streamlit | PARTIAL (runtime) | `streamlit/lib/streamlit/elements/widgets/button.py` (`page_link`), `streamlit/lib/streamlit/errors.py` (`StreamlitPageNotFoundError`), `streamlit/lib/tests/streamlit/elements/page_link_test.py`                            | `st.page_link("pages/x.py")` resolves the path against the app's registered pages and raises when none matches — at run time, when the page renders                                                                                                                                  |

**Count:** 4 of 4 check internal links in some form; 2 fail on a broken one (evidence, VitePress), 1 warns and wants to fail (framework). The backlog row settles it: biac fails.

## Implementation inventory

All paths relative to `research_repos/`.

### framework

| Concern                    | Files                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fence grammar              | `framework/src/markdown.ts` — `getLiveSource` (which tags run), the fence renderer reading `attributes.echo` / `attributes.run`, `isFalse`                                     |
| Render-then-show order     | `framework/src/markdown.ts` — the block placeholder is appended to `html` before `baseRenderer(...)` emits the code                                                            |
| Syntax error in a snippet  | `framework/src/markdown.ts` — `SyntaxError` caught and rendered as an inline `observablehq--error` block in place of the output                                                |
| Author-facing docs         | `framework/docs/javascript.md` ("JavaScript blocks do not show their code by default"), `framework/docs/jsx.md`                                                                |
| Link collection            | `framework/src/html.ts` — `findAssets`: skips `isExternal`, `download`, `^\w+:` URLs; `parseRelativeUrl` + `resolvePath` against the page; `.html` and trailing `/` normalised |
| Link validation and report | `framework/src/build.ts` — `validateLinks` (targets = page paths + `path#encodeURIComponent(anchor)`), the warn/log block after the size report                                |
| Tests                      | `framework/test/build-test.ts`, `framework/test/html-test.ts`, `framework/test/markdown-test.ts`                                                                               |

### mosaic

| Concern            | Files                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Rendering one spec | `mosaic/docs/.vitepress/theme/Example.vue` (`parseSpec`, `astToDOM`, error state in `mounted`) |
| Showing the same   | `mosaic/docs/examples/aeromagnetic-survey.md` (`::: code-group` + `<<< @/public/specs/…`)      |
| Dead-link policy   | `mosaic/docs/.vitepress/config.js` (no `ignoreDeadLinks`)                                      |

### evidence

| Concern                 | Files                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Source-only examples    | `evidence/core/src/user-components/nodes/link/schema.ts` (`examples`), `evidence/cli/src/lib/docs/index.ts`                    |
| Link validator          | `evidence/core/src/user-components/validators/isTreePath.ts` (three distinct messages: no project, no segment, ends at folder) |
| Where it applies        | `evidence/core/src/user-components/nodes/link/schema.ts` (`or(isUrl, isTreePath)` on `href`)                                   |
| Internal-link rewriting | `evidence/core/src/user-components/common/transform-internal-link.ts`                                                          |
| Reporting               | `evidence/cli/cli/validate.ts` (`FileError` with `line`, `id`, `severity`; human vs JSON output)                               |

### streamlit

| Concern              | Files                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Echo                 | `streamlit/lib/streamlit/commands/echo.py` (source read via `ast`, `code_location`, still runs when the source is unreadable) |
| Echo tests           | `streamlit/lib/tests/streamlit/elements/echo_test.py`, `streamlit/lib/tests/streamlit/echo_test_data/`                        |
| Page-link resolution | `streamlit/lib/streamlit/elements/widgets/button.py` (`page_link`), `streamlit/lib/streamlit/errors.py`                       |
| Page-link tests      | `streamlit/lib/tests/streamlit/elements/page_link_test.py`                                                                    |

**Disagreements:** framework puts output before code, streamlit puts code above by default and offers a switch (O2). framework checks `#anchor` targets, evidence checks page paths only (O3). framework warns, evidence and VitePress fail (settled: fail). framework checks rendered HTML after the build, evidence checks the parsed document before render (O4).

## Trade-offs and what we adopt

| Axis                     | Options seen (repo → approach)                                                                           | Trade-off                                                                                                                                        | Our choice, and why                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Snippet grammar          | framework → fence + `echo`; mosaic → one file, two references; streamlit → a context manager around code | A fence keeps the snippet in the page and reuses ADR-0011's info-string grammar; a wrapper tag needs the engine to slice its own source back out | O1 — recommended: ` ```mdx echo ` fence        |
| Order of output and code | framework → output then code; streamlit → code above (default) or below                                  | A switch is one more token to learn                                                                                                              | O2 — recommended: framework's order, no switch |
| Fail or warn             | framework → warn; evidence, VitePress → fail                                                             | Failing blocks a deploy over one typo; warning ships broken links to readers                                                                     | Fail — settled by the backlog row              |
| What counts as a target  | framework → pages + `#anchor`; evidence → pages                                                          | Anchor ids are generated in the browser here                                                                                                     | O3 — recommended: page routes only             |
| When the check runs      | framework → after the build, on HTML; evidence → before render, on the parsed doc                        | Before bundling fails fast and leaves no half-written `build/`                                                                                   | O4 — recommended: `buildStart`                 |

## Gap analysis — what we already have vs the references

| Concern                     | Ours today (file)                                                                                                                                                                                                         | Best reference (file)                                                                 | Gap                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fence flags                 | `src/engine/sql-fence-meta.ts` (`parseSqlFenceMeta`) and `registerSqlBlock` in `src/engine/compile-page.ts` — `echo`/`display` for ` ```sql ` only, unknown token is a compile error (ADR-0011)                           | `framework/src/markdown.ts`                                                           | partial for SQL; absent for markup — GAP-065                                                                                                                                                                      |
| Splicing markup into a page | none; the remark chain in `compilePage` is `remarkGfm`, `remarkPageMetadata`, `remarkQueryFiles`, `remarkWidgetExports`, `remarkRejectReservedFilterIds`, `remarkRejectUnknownSearchMethod`, `remarkCheckTranslationKeys` | `framework/src/markdown.ts`                                                           | absent — a splice plugin must run right after `remarkGfm` so spliced JSX meets every later check (`data=` query files, reserved filter ids, search method, translations, widget exports) as hand-written JSX does |
| Showing the code            | `SqlBlockPre` in `src/web/src/features/pages/sql-block.tsx` → `HighlightedPre` (`highlighted-pre.tsx`); `highlightFence` in `src/web/src/features/pages/shiki-highlighter.ts` lazy-loads any shiki bundled language       | —                                                                                     | complete — an ` ```mdx ` fence already highlights                                                                                                                                                                 |
| Search index                | `src/engine/page-search-text.ts` skips `code` nodes and JSX that reads `data=`                                                                                                                                            | —                                                                                     | to settle in T1: spliced nodes must not index the same text twice                                                                                                                                                 |
| Compile-error location      | `src/engine/compile-page.ts` pads stripped front-matter so positions match the file; `src/engine/page-compile-error.ts`                                                                                                   | `framework/src/markdown.ts` (inline SyntaxError)                                      | absent for snippets — a parse of the fence body reports positions relative to the fence                                                                                                                           |
| Link rendering              | `ProseLink` in `src/web/src/features/pages/prose-elements.tsx`: `/`-prefixed → router `Link` (base path applied), anything else → plain `<a>`                                                                             | —                                                                                     | complete for rendering                                                                                                                                                                                            |
| Link collection and check   | none                                                                                                                                                                                                                      | `evidence/core/src/user-components/validators/isTreePath.ts`, `framework/src/html.ts` | absent — GAP-066                                                                                                                                                                                                  |
| Route set                   | `discoverPages` in `src/engine/discover-pages.ts`; `buildStart` in `src/engine/pages-plugin.ts` already runs `assertRoutesBuildable` (`src/engine/build-route-pages.ts`) before loaders                                   | `framework/src/build.ts`                                                              | reusable — the check slots in beside `assertRoutesBuildable`                                                                                                                                                      |
| Heading anchors             | ids assigned in the browser by `collectTocHeadings` / `slugifyHeading` in `src/web/src/features/chrome/toc-headings.ts`                                                                                                   | `framework/src/html.ts` (`anchors`)                                                   | the engine cannot see anchor ids without porting the slug rule — constrains O3                                                                                                                                    |
| Example project links       | `pages/` holds 10 pages; internal links at `pages/index.md:12`, `pages/weekly-review.md:12`, `pages/weekly-review.md:306`, `pages/nested/allocation.md:32`, `pages/nested/page.md:10` — all resolve                       | —                                                                                     | the check must pass on them                                                                                                                                                                                       |

State: both capabilities **absent**. Nothing in the ledger claims either.

## Deviations

- No `run=false` (framework): a plain ` ```mdx ` fence already shows code without rendering it.
- No in-dev link check: the build is where a broken link stops a deploy; dev keeps rendering. A broken link in dev lands on the not-found page as today.

## Open decisions

| Id  | Decision                     | Options                                                                                                      | Evidence to gather                                                                                                                                                                           | Recommendation                                                                                                         |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| O1  | Snippet grammar              | ` ```mdx echo ` fence (framework) vs an `<Example>` wrapper whose children render (mosaic's one-source idea) | Does a remark plugin parsing the fence body with the page's MDX parser keep every later plugin's checks; how a nested ` ```sql ` inside the snippet is written (a four-backtick outer fence) | ` ```mdx echo `; plain ` ```mdx ` unchanged; any other token a compile error naming the accepted set, as ADR-0011 does |
| O2  | Output and code order        | Output then code (framework) vs code above, switchable (streamlit)                                           | —                                                                                                                                                                                            | Output then code, no switch                                                                                            |
| O3  | Link targets checked         | Page routes only (evidence) vs + `#anchor` (framework) vs + `/data/` files                                   | Cost of moving `slugifyHeading` to a module both engine and web may import                                                                                                                   | Page routes only; anchors named out of scope                                                                           |
| O4  | Where the check runs         | `buildStart` over each page's parsed mdast vs collected during `transform` and checked in `generateBundle`   | Parse time for the 10 example pages (`/usr/bin/time`)                                                                                                                                        | `buildStart`, beside `assertRoutesBuildable`                                                                           |
| O5  | Relative links (`x`, `../x`) | Resolve against the page route (framework `resolvePath`) vs reject anything not `/`-rooted                   | What URL the browser resolves a relative `<a>` against on a route served by ADR-0029's per-route `index.html` copy (trailing slash or not), in dev and build                                 | Settle from the measurement                                                                                            |
| O6  | Link sources scanned         | Markdown `link`, reference `definition`, MDX JSX `<a href="…">` with a literal value                         | Whether any widget takes an internal-link prop with a literal value (none found by grep today)                                                                                               | All three; expression-valued `href` skipped                                                                            |

## Surface

| Layer  | Files                                                                                                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | `src/engine/compile-page.ts`, a new snippet remark plugin beside it, a new internal-link check module, `src/engine/pages-plugin.ts` (`buildStart`), `src/engine/page-search-text.ts`                                    |
| client | —                                                                                                                                                                                                                       |
| ui     | `src/web/src/features/pages/sql-block.tsx` (the `pre` override) or a sibling; its `.stories.tsx`                                                                                                                        |
| tests  | `src/engine/*.unit.test.ts`, `test/integration/pages-plugin.integration.test.ts`, `test/integration/static-build.integration.test.ts`, `test/e2e/static-build.e2e.test.ts`, `test/e2e-browser/markdown-widgets.spec.ts` |
| pages  | one example page in `pages/` carrying a snippet                                                                                                                                                                         |

## Tasks

- [ ] T1 — ` ```mdx echo ` renders its markup and shows it from one copy, end to end: settle O1/O2; engine splice plugin first in the chain; `pre` override shows the code; a snippet on an example page; unit, integration, browser e2e, story; `playwright-cli` on that page (widget count, code block present, console clean)
- [ ] T2 — a snippet that fails to compile names its line in the page file, not in the fence; the page-compile-error page shows it; `playwright-cli` on the broken page
- [ ] T3 — `biac build` fails on a broken internal link naming `pages/<file>:<line>` and the target: settle O3–O6; `pages/` builds clean; e2e on the static build
- [ ] T4 — ADR(s) for the snippet fence and the link check; close GAP-065 and GAP-066 in `docs/research/docs-site.md`; demo run

## Out of scope

- `#anchor` link targets (O3) — they need heading ids in the engine.
- Docs pages that use the snippet — SL-061.
- Checking external URLs — no reference does it at build.
