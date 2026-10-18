# SL-046 — A page or a whole project spans the full width and puts each widget on a card

Milestone: Phase 4 — Project and page settings, themes, layouts · State: open · Depends on: SL-045 · Closes: GAP-039, GAP-044

## Outcome

An author sets `layout: { page_width: "full", cards: true }` in `biac.config.ts`, or `page_width:` / `cards:` in one page's front-matter (the page wins), and the page content spans the space beside the sidebar and each chart, table and big value sits on its own card — today every page is pinned to a 56rem column on the bare background.

## Demo

1. Cold start: `bin/biac dev`, open the example dashboard page (added in T4) at a 1920px viewport. It renders in the article column (`main` 848px beside the ToC rail, inside the 1152px outer cap), widgets on the page background.
2. Add `page_width: full` to that page's front-matter and save. Without a reload, the outer container fills the row beside the sidebar and `main` widens past 848px; the ToC rail still shows.
3. Add `cards: true` to the front-matter. Each chart, `Table` and `BigValue` sits on a bordered card on a tinted page background; inputs, `FilterBar`, callouts, tabs and inline `Value`/`Delta` do not; a chart inside a `<Tabs>` panel gets exactly one card.
4. Remove both front-matter keys and put `layout: { page_width: "full", cards: true }` in `biac.config.ts`. Every page is full width with cards; a second page with `cards: false` in its front-matter has none.
5. Type `page_width: wide` in the front-matter: a located error names the file, `page_width`, `"article" | "full"` and `"wide"`. Type `layout: { cardz: true }` in `biac.config.ts`: the SL-045 error names `layout.cardz`, the accepted keys and the closest. Fix both — the page comes back by itself.
6. `bin/biac build` + `bin/biac preview`: the same pages render the same widths and cards.
7. Reload — the effect persists.

## Who else implements this

Paths are relative to `research_repos/`, verified with `test -e` on 2026-10-18.

| Repo      | Has it                                                | Entry points                                                                                                                                                                                                                 | Approach in one line                                                                                                                                                                                              |
| --------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | FULL — width and cards, project + page                | `evidence/core/src/config/page-frontmatter-schema.ts`, `evidence/cli/src/lib/markdown/files.server.ts`, `evidence/cli/src/routes/[...path]/+page.svelte`, `evidence/core/src/user-components/common/ComponentWrapper.svelte` | `layout.page_width` `article`\|`full` and `layout.cards` in `evidence.config.yaml`, overridden key-by-key by front-matter; `article` is `max-w-[64rem]`, `full` drops it; cards wrap every component not `noCard` |
| framework | PARTIAL — width (theme), manual cards                 | `framework/src/style/theme-wide.css`, `framework/src/theme.ts`, `framework/src/style/card.css`, `framework/docs/markdown.md`                                                                                                 | `theme: [..., "wide"]` (or `dashboard` = `alt` + `wide`) sets `--observablehq-max-width: 100vw`; cards are an author-written `<div class="card">`, nothing automatic                                              |
| mosaic    | ABSENT                                                | —                                                                                                                                                                                                                            | Spec `hconcat`/`vconcat` compose plots; no page width or card setting                                                                                                                                             |
| streamlit | PARTIAL — width (app + per page), bordered containers | `streamlit/lib/streamlit/commands/page_config.py`, `streamlit/frontend/app/src/App.tsx`, `streamlit/frontend/app/src/components/AppView/styled-components.ts`, `streamlit/lib/streamlit/elements/layouts.py`                 | `st.set_page_config(layout="centered"\|"wide")`, plus a viewer "wide mode" toggle; `st.container(border=True)` is an author-placed card                                                                           |

**Count:** 3 of 4 have a page-width switch (evidence, framework, streamlit); 1 of 4 cards widgets automatically (evidence), 2 more offer an author-placed card (framework `.card`, streamlit `border=True`). Width is justified by frequency; automatic cards come from evidence alone, and are taken because they are the only form that needs no markup per widget — the point of a project-level switch.

## Implementation inventory

### evidence

| Concern                        | Files                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data model / schema            | `evidence/core/src/config/page-frontmatter-schema.ts` (front-matter `page_width` z.enum, `cards` z.coerce.boolean, both `.catch(undefined)`; `projectLayoutSchema` for the config block), `evidence/core/src/user-components/interfaces/project-settings.ts` (`cards`, `page_width`), `evidence/cli/cli/project-config/load-config.ts`                                                                             |
| Pipeline / execution           | `evidence/cli/src/lib/markdown/files.server.ts` (`DEFAULT_PAGE_SETTINGS` `{page_width: 'article', cards: false}`; `resolvePageSettings` = defaults < project `layout` < front-matter, only present keys override), `evidence/cli/src/routes/+page.server.ts` (same merge for `/`)                                                                                                                                  |
| Client / state                 | `evidence/core/src/user-components/common/card-context.svelte.ts` (`insideCard`), `evidence/core/src/user-components/common/NoCardScope.svelte` (forces `insideCard` for a subtree; used by `tags/accordion/Accordion.svelte`)                                                                                                                                                                                     |
| UI entry point                 | `evidence/cli/src/routes/[...path]/+page.svelte` and `evidence/cli/src/routes/+page.svelte` (`max-w-[64rem]` unless `full` or `?fullscreen`; card mode sets `bg-card-mode-background` on the page and the body), `evidence/core/src/user-components/common/ComponentWrapper.svelte` (`isCard` → `bg-card p-card-pad rounded-md border shadow-xs`)                                                                  |
| Which components get a card    | `evidence/core/src/user-components/types.ts` (`noCard`); 23 schemas set `noCard: true` (`grep -rl "noCard: true" evidence/core/src/user-components`): inputs (dropdown, slider, toggle, text_input, button_group, range_calendar, date_grain_selector, comparison_selector, table_filter, input_tabs), tabs, callout, details, accordion, accordion_item, modal, commentary, image, audio, file, row, stack, fence |
| Row / Stack                    | `evidence/core/src/user-components/tags/row/Row.svelte`, `evidence/core/src/user-components/tags/stack/Stack.svelte` (`card` prop: the group becomes one card and its children get none)                                                                                                                                                                                                                           |
| Tokens                         | `evidence/core/src/styles/base.css` (`--card`, `--card-mode-background` light `oklch(0.985 0 0)` / dark, `--spacing-card-pad: 1rem`), `evidence/core/src/theme/theme-css-helper.ts` (card-mode text colours), `evidence/core/src/theme/THEMES.md` (`cardLayoutBackground`)                                                                                                                                         |
| Card-aware widgets             | `evidence/core/src/user-components/tags/table/Table.svelte` (colour scale adjusted to the card background), `tags/heatmap/Heatmap.svelte`, `tags/map/Map.svelte`, `tags/calendar_heatmap/CalendarHeatmap.svelte`                                                                                                                                                                                                   |
| Empty / error / loading states | A bad value is dropped (`.catch(undefined)`) and the layer below applies — no error                                                                                                                                                                                                                                                                                                                                |
| Docs                           | `evidence/docs/features/page-settings.mdx`, `evidence/docs/features/project-settings.mdx` ("Wrap each component in a card (border + shadow) for a dashboard look")                                                                                                                                                                                                                                                 |
| Tests                          | `evidence/cli/src/lib/markdown/files.server.test.ts`, `evidence/cli/src/routes/home-page-load.test.ts`                                                                                                                                                                                                                                                                                                             |

### framework

| Concern        | Files                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data model     | `framework/src/theme.ts` (`wide` and `alt` modifiers; `dashboard` pushes both), `framework/docs/config.md` § theme                                                                   |
| UI entry point | `framework/src/style/layout.css` (`--observablehq-max-width: 1440px` caps `#observablehq-center`), `framework/src/style/theme-wide.css` (`100vw`)                                    |
| Cards          | `framework/src/style/card.css` (`--theme-background-alt`, 1px `--theme-foreground-faintest` border, `0.75rem` radius, `1rem` padding), `framework/docs/markdown.md` § Grids, § Cards |
| Edge cases     | `.grid > .card` drops the margin; first/last child margins collapse inside a card                                                                                                    |

### streamlit

| Concern        | Files                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model     | `streamlit/lib/streamlit/commands/page_config.py` (`Layout = Literal["centered", "wide"]`)                                                                                                                       |
| Client / state | `streamlit/frontend/app/src/App.tsx` (`layout` → `userSettings.wideMode`, re-applied only when the page config changes), `streamlit/frontend/app/src/components/StreamlitDialog/UserSettings.ts` (viewer toggle) |
| UI entry point | `streamlit/frontend/app/src/components/AppView/styled-components.ts` (`applyWideModePadding`, `isWideMode`), `streamlit/frontend/app/src/components/AppView/AppView.tsx`                                         |
| Cards          | `streamlit/lib/streamlit/elements/layouts.py` (`container(border=...)`, shown by default only at a fixed height)                                                                                                 |

**Disagreements the slice settles:** (1) evidence configures width per project and per page; framework per project (and per page through front-matter `theme`); streamlit per page call, with a viewer override. (2) evidence cards automatically, framework and streamlit only where the author writes one. (3) evidence silently drops a bad value; ours fails located (below).

## Trade-offs and what we adopt

| Axis                         | Options seen (repo → approach)                                                                           | Trade-off                                                                                                      | Our choice, and why                                                                                                                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Key names                    | evidence `layout.page_width`/`layout.cards`; framework `theme: "wide"`; streamlit `layout="wide"`        | Our `theme` key is the colour mode (`BiacTheme`), so framework's shape is taken                                | evidence's: `layout: { page_width, cards }`, snake_case like the existing front-matter `table_of_contents`; SL-047 adds `layout.table_of_contents` beside them                                                                                                                                     |
| Values                       | evidence `article`\|`full`; streamlit `centered`\|`wide`                                                 | —                                                                                                              | `article`\|`full`, default `article`                                                                                                                                                                                                                                                               |
| Layer order                  | evidence defaults < project `layout` < front-matter, only present keys override                          | —                                                                                                              | Same order, key by key                                                                                                                                                                                                                                                                             |
| Where layers merge           | evidence on the server per page                                                                          | Merging in the engine bakes the config into every compiled page, so a config edit recompiles every page        | Engine validates both layers; client merges, as `src/web/src/features/pages/page-router.tsx` already merges `site.sqlTables` under `mod.sqlTables`. A `biac.config.ts` edit already reloads the tab (`hotUpdate` in `src/engine/pages-plugin.ts`)                                                  |
| Bad value                    | evidence `.catch(undefined)` drops it; framework coerces                                                 | Silent drop hides the typo                                                                                     | Located error naming field, expected values and the value — `src/engine/biac-config-error.ts` `invalid()` for the config, the `sql-frontmatter.ts` `invalidSql` shape (`front-matter in <file>`) for the page                                                                                      |
| What `full` removes          | evidence drops `max-w-[64rem]`; framework sets the cap to `100vw`                                        | —                                                                                                              | Both caps in `MarkdownPage` (`max-w-6xl` outer, `max-w-4xl` on `main`); the ToC rail keeps showing (user decision, 2026-10-18)                                                                                                                                                                     |
| What gets a card             | evidence every component except `noCard`; framework/streamlit author-placed                              | Author-placed needs markup on every widget, which a project switch exists to avoid                             | evidence's: charts (`BarChart`, `LineChart`, `AreaChart`, `ScatterChart`, `Histogram`, `Heatmap`), `Table`, `BigValue`. Not inputs, `FilterBar`, `Callout`/`Note`, `Details`, `Tabs`/`Tab`, `Accordion`, inline `Value`/`Delta`/`Sparkline`, `Row`/`Stack`, sql fences (user decision, 2026-10-18) |
| Nesting                      | evidence `insideCard` context + `NoCardScope`                                                            | Without it a card inside an accordion card doubles the border                                                  | Nothing inside a card gets a second card. evidence's `Accordion.svelte` wraps only the item _title_ in `NoCardScope`, so its accordion content still gets cards; ours scopes the content of a `well`/`card` accordion (it draws its own box) and leaves a `default` accordion's widgets carded     |
| Page background in card mode | evidence `--card-mode-background`; framework cards use `--theme-background-alt` on the normal background | Our `--background` and `--card` are both `#ffffff` in light, so a card is invisible without a tint or a border | A tinted page background in card mode (O2 settles the token)                                                                                                                                                                                                                                       |

## Gap analysis — what we already have vs the references

| Concern                 | Ours today (file)                                                                                                                                                                                   | Best reference (file)                                                       | Gap                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Config key              | `src/engine/biac-config.ts` `CONFIG_KEYS` = `title`, `theme`, `nav`, `sql`, `interpreters`; `rejectUnknownKeys` makes `layout:` an error today                                                      | `evidence/core/src/config/page-frontmatter-schema.ts` `projectLayoutSchema` | absent                                                                               |
| Resolved config type    | `src/engine/types.ts` `BiacConfig` has no layout                                                                                                                                                    | `evidence/core/src/user-components/interfaces/project-settings.ts`          | absent                                                                               |
| Config to the browser   | `src/engine/pages-plugin.ts` `configModuleSource` sends `title`, `theme`, `nav`, `sqlTables`                                                                                                        | —                                                                           | absent — a `layout` field joins them                                                 |
| Front-matter validation | `src/engine/compile-page.ts` validates `sql:` via `src/engine/sql-frontmatter.ts` `sqlTableMap(…, "front-matter in <file>")`; `PageFrontmatter` is otherwise untyped                                | `evidence/core/src/config/page-frontmatter-schema.ts`                       | absent for `page_width`/`cards`; the located-error precedent exists                  |
| Layer merge             | `src/web/src/features/pages/page-router.tsx` merges config under page for `sqlTables` only                                                                                                          | `evidence/cli/src/lib/markdown/files.server.ts` `resolvePageSettings`       | absent                                                                               |
| Page width (GAP-039)    | `src/web/src/features/pages/markdown-page.tsx` `MarkdownPage`: `@container mx-auto flex max-w-6xl` outer, `main` `max-w-4xl` (56rem = 896px); no key changes it                                     | `evidence/cli/src/routes/[...path]/+page.svelte` `widthClass`               | absent                                                                               |
| ToC beside a full page  | `MarkdownPage` renders `NavToc` unless front-matter `table_of_contents: false`                                                                                                                      | evidence ToC is independent of width                                        | complete — stays as it is                                                            |
| Cards (GAP-044)         | `mdxComponents` in `src/web/src/features/pages/markdown-page.tsx` is one static map; no wrapper, no context                                                                                         | `evidence/core/src/user-components/common/ComponentWrapper.svelte`          | absent                                                                               |
| Card tokens             | `src/web/src/styles.css` `--card` (`#ffffff` light, `#171717` dark), `--card-border` (`#e5e5e5` / `#404040`), `--radius: 0.5rem`, `--spacing-block-gap: 1rem`; `--background` `#ffffff` / `#0a0a0a` | `evidence/core/src/styles/base.css` `--card-mode-background`                | partial — card surface and border exist (ADR-0014 hex); no card-mode page background |
| Nesting                 | `Accordion` already draws its own card (`--card` comment in `src/web/src/styles.css`: "accordion card")                                                                                             | `evidence/core/src/user-components/common/NoCardScope.svelte`               | absent                                                                               |
| Other page renderers    | `src/web/src/features/pages/editable-page.tsx` and `src/web/src/features/editor/page-editor.tsx` render `MarkdownPage` too; the editor preview pane is half the screen                              | —                                                                           | must follow the same settings — check in T1 and T3                                   |
| Row/Stack `card` prop   | `src/web/src/features/widgets/markdown/types.ts` `RowProps`/`StackProps` take `align` only                                                                                                          | `evidence/core/src/user-components/tags/row/Row.svelte` `card`              | absent — out of scope                                                                |

Overall: **absent**. Nothing in the ledger claims any part of this as shipped.

## Deviations

- A bad `page_width`/`cards` value is a located error, not evidence's silent drop. This is the rule SL-020/SL-026/SL-045 already follow; it is stated in a code comment where the value is read.
- No `?fullscreen` parameter and no viewer wide-mode toggle (streamlit). Width is the author's setting.

## Open decisions

| Id  | Decision                                                                                   | Evidence to gather first                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | How a widget gets its card — **settled: static `withCard` map + card-scope context**       | A card-aware component map built in `MarkdownPage` when `cards` is on, vs one `WidgetCard` each carded widget renders that reads a cards context (evidence's `ComponentWrapper.svelte` + `card-context.svelte.ts`). Read how `Tabs`/`Accordion` render children; the map can't see nesting, a context can                                    |
| O2  | The card-mode page background token — **settled: `#fafafa` light, `#0a0a0a` dark**         | Light and dark hex (ADR-0014: tokens are hex), measured contrast of `--card-border` against it and against `--card` (WCAG 2.2 1.4.11 non-text 3:1, https://www.w3.org/TR/WCAG22/#non-text-contrast), and whether text on it keeps 4.5:1. A new token is an ADR-0014 amendment or a new ADR                                                   |
| O3  | `full` with `nav.sidebar: false` and in the editor preview — **settled: no extra padding** | Measured with `playwright-cli` on `bin/biac dev`: with `nav.sidebar: false` + `full`, `main` is 1872px at 1920 and 1392px at 1440, starting at x=24 — the container's `px-6` gutters already frame it. The editor preview pane is 816px at 1920, under both caps, so `main` is 768px for `article` and `full` alike — nothing changes there. |

## Surface

| Layer  | Files                                                                                                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | `src/engine/biac-config.ts`, `src/engine/types.ts`, `src/engine/pages-plugin.ts` (`configModuleSource`), `src/engine/compile-page.ts`, a new page-layout front-matter reader beside `src/engine/sql-frontmatter.ts`     |
| client | `src/web/src/features/pages/page-router.tsx` (merge), `src/web/src/features/pages/types.ts`, `src/web/src/virtual-biac-config.d.ts`                                                                                     |
| ui     | `src/web/src/features/pages/markdown-page.tsx`, `src/web/src/styles.css`, the carded widgets' entry points under `src/web/src/features/widgets/` (`charts/`, `table/`, `value/`), stories beside each changed component |
| tests  | `src/engine/biac-config.unit.test.ts`, a unit test beside the new front-matter reader, `test/integration/`, `test/e2e/`, `test/e2e-browser/`, `test/integration/features/page-chrome.feature` (cucumber)                |

## Tasks

- [x] T1 — Front-matter `page_width: article|full`: the engine reads and validates it (located error on any other value), the page carries it, `MarkdownPage` drops both caps for `full`. Measure `main` width at 1920px, 1440px and 768px before/after on a `pages/` page, in the editor preview too (O3).

Baseline, measured 2026-10-18 with `playwright-cli` on `bin/biac dev` (sidebar open, `main.getBoundingClientRect().width` and its parent's):

| Page                       | Viewport | `main`       | outer container | ToC rail |
| -------------------------- | -------- | ------------ | --------------- | -------- |
| `/weekly-review` (has ToC) | 1920     | 848          | 1152 (capped)   | 224      |
| `/weekly-review`           | 1440     | 848          | 1152            | 224      |
| `/weekly-review`           | 768      | 720          | 768             | hidden   |
| `/` (no ToC rail)          | 1440     | 896 (capped) | —               | none     |

At 1440px the outer cap equals the space beside the 288px sidebar, so on a page with a ToC rail `full` gains nothing at that size. Measure the gain at 1920px, or on a page without the rail. Console: 0 errors, 0 warnings.

After T1, `page_width: full` in front-matter, same method:

| Page             | Viewport | `main` | outer container | ToC rail |
| ---------------- | -------- | ------ | --------------- | -------- |
| `/weekly-review` | 1920     | 1328   | 1632            | 224      |
| `/weekly-review` | 1440     | 848    | 1152            | 224      |
| `/weekly-review` | 768      | 720    | 768             | hidden   |
| `/`              | 1920     | 1584   | 1632            | none     |
| `/`              | 1440     | 1104   | 1152            | none     |

The page carries the validated value as its `layout` module export (`src/engine/page-layout-frontmatter.ts` `pageLayout`), absent when the page sets none, so T2 merges `biac.config.ts` `layout` under it key by key. Paragraphs keep their own measure at `full`; tables, charts and the filter row widen.

- [x] T2 — `layout: { page_width }` in `biac.config.ts`: `layout` joins `CONFIG_KEYS` with its own accepted-keys list (unknown key and bad value located, as in SL-045), ships in `virtual:biac-config`, merges under the page's front-matter. Measure two pages, one overriding.

After T2, `layout: { page_width: "full" }` in `biac.config.ts`, `/` overriding with front-matter `page_width: article`, same method:

| Page                         | Viewport | `main` | outer container | ToC rail |
| ---------------------------- | -------- | ------ | --------------- | -------- |
| `/weekly-review` (inherits)  | 1920     | 1328   | 1632            | 224      |
| `/weekly-review`             | 1440     | 848    | 1152            | 224      |
| `/weekly-review`             | 768      | 720    | 768             | hidden   |
| `/` (overrides to `article`) | 1920     | 896    | 1152            | none     |
| `/?edit` (editor preview)    | 1920     | 768    | 816             | none     |

The resolved config's `layout` is concrete (`page_width: "article"` when omitted); `CompiledPage` in `src/web/src/features/pages/page-router.tsx` spreads the page's partial `layout` over it. `layout: { cardz: true }` fails `Invalid biac.config.ts:2:13 — layout.cardz: unknown key, expected one of page_width`, and the fix brings the page back with 0 console errors. T3 adds `cards` to `LAYOUT_KEYS` in `src/engine/biac-config.ts`.

- [x] T3 — `cards` in front-matter and `layout.cards`: settle O1 and O2, wrap the carded widgets, tint the page background, no nested cards; stories for carded and uncarded states, contrast measured light and dark. Measure card count per page with `eval`.
      After T3, `cards: true` on `/weekly-review` (with `page_width: full`), measured 2026-10-18 with `playwright-cli` on `bin/biac dev` at 1920px:

| Measure                                  | Light                    | Dark                        |
| ---------------------------------------- | ------------------------ | --------------------------- |
| `[data-widget-card]` count               | 13                       | 13                          |
| nested cards / cards per tab panel       | 0 / 1, 1                 | 0 / 1, 1                    |
| cards in an accordion / FilterBar carded | 0 / no                   | 0 / no                      |
| page tint / card / card border           | #fafafa / #fff / #e5e5e5 | #0a0a0a / #171717 / #404040 |
| `--muted-foreground-faded` on the tint   | 4.54:1                   | 7.66:1                      |

13 = 3 `BigValue`, 7 charts, 3 `Table`. O1: `withCard` in `src/web/src/features/widgets/card/with-card.tsx` wraps each carded entry of the static `mdxComponents` map once, and `card-scope.tsx` carries `cards` and `insideCard`, so a toggle changes context only (the in-place probe survived) and a widget under a card or a `NoCardScope` gets none. O2: `--card-mode-background` (ADR-0014). `layout: { cards: true }` in `biac.config.ts` cards `/weekly-review`; `/` with `cards: false` has 0 cards and no tint after client navigation. `cards: yes please` and `layout.cardz` fail located (`biac.config.ts:2:33 — layout.cardz: unknown key, expected one of page_width, cards (did you mean cards?)`); the fix restores 13 cards, 0 alerts, console clean.

- [ ] T4 — Example dashboard page in `pages/` (full + cards) and a page opting out; e2e-browser spec through the real pages; demo run ready; GAP-039 and GAP-044 rows re-measured for closing.

## Out of scope

- Project `table_of_contents` default and folder titles — SL-047.
- Brand colours, card background as a brand token — SL-048, SL-063.
- A `card` prop on `<Row>`/`<Stack>` — not in the backlog; evidence only.
- streamlit's viewer wide-mode toggle and evidence's `?fullscreen` parameter.
