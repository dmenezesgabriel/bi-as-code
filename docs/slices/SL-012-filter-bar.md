# SL-012 — <FilterBar> sticky container for filter inputs

Milestone: Phase 1 — A usable BI-as-code product · State: open · Depends on: SL-010, SL-011 · Closes: —

## Outcome

A page author can wrap filter inputs in `<FilterBar>` so they lay out as one horizontal bar that sticks under the page header on scroll and gains a floating card style (opaque background, border, shadow, padding) once its rest position passes the viewport top. The bar is purely presentational: inputs inside keep their `?id=` URL-param writes and `filters=[...]` predicates untouched.

## Demo

A numbered script a human runs from a cold start. The slice is not `shipped` until this has been run in the real app.

1. `bin/biac dev`, open `http://localhost:5175/weekly-review` — the Region `<Dropdown>`, Amount `<Slider>`, Ordered `<DateRange>`, search `<TextInput>` and `<Toggle>` sit inside one bar at the top of the article.
2. Scroll down — the bar stays pinned under the header and, once its rest position leaves the viewport, gains its card style while content scrolls beneath it.
3. Scroll back up — the card style drops as soon as the bar's rest position re-enters the viewport.
4. Pick a region in the pinned bar — `?region=` writes and filtered widgets re-query; the bar does not move or flash.
5. `http://localhost:5175/nested/allocation` — the Channel `<ButtonGroup>` + `<MultiSelect>` bar behaves the same.
6. Reload both URLs — input state restores from `?id=` params; `console` stays clean.

## Who else implements this

Every reference repo gets a row, including the ones that do not have it.

| Repo      | Has it | Entry points                                                                                                                                                          | Approach in one line                                                                                                     |
| --------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| evidence  | FULL   | `core/src/user-components/tags/filter_bar/FilterBar.svelte`, `schema.ts`, `user-component.ts`, `core/src/useIntersection.svelte.ts`, `docs/components/filter_bar.mdx` | zero-height sentinel div + IntersectionObserver flips the sticky bar to a floating card once scrolled past               |
| framework | ABSENT | —                                                                                                                                                                     | inputs are placed inline in markdown; no sticky container exists                                                         |
| mosaic    | ABSENT | —                                                                                                                                                                     | standalone inputs; `packages/vgplot/vgplot/src/layout/` `hconcat`/`vconcat` arrange them, nothing pins on scroll         |
| streamlit | ABSENT | —                                                                                                                                                                     | `st.sidebar` is the nearest analog — a fixed panel, not a floating bar; `multiselect.py` chips are per-widget, unrelated |

**Count:** 1 of 4 implement this. It survives because SL-009–SL-011 already ported evidence's filter-UX surface and the ledger routes `<FilterBar>` to this slice (`docs/research/widget-catalog.md`). Note for future sessions: `docs/research/feature-census.md` described this row "(dismissable chips of active filters)" — wrong; the cited evidence source is a sticky input container. The chips concept belongs to `table_filter` (`core/src/user-components/tags/table_filter/FilterChips.svelte`), catalogued `later`.

## Implementation inventory

evidence is the only repo that has it — read the real code, don't take this table's word.

### evidence (`research_repos/evidence/`)

| Concern                        | Files                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI entry point                 | `core/src/user-components/tags/filter_bar/FilterBar.svelte` — sentinel div (`-mt-4 mb-4`, margins match the `top-4` dock offset), `sticky top-4 z-50 flex flex-row flex-wrap items-end gap-4 rounded-md border pt-3 pb-2 transition-all`, `floating` adds `bg-background border-border px-4 shadow`                         |
| Prop schema / allowed children | `core/src/user-components/tags/filter_bar/schema.ts` — `category: 'input'`, `selfClosing: false`, `allowedChildren: [dropdown, table_filter, date_grain_selector, comparison_selector, range_calendar, button_group]`, `componentWrapper: false`; `core/src/user-components/types.ts` `UserComponentSchema.allowedChildren` |
| Children enforcement           | `core/src/user-components/Renderer/MarkdocProcessor/process-markdoc.ts` ~line 1122 — compile-time `invalid-child` error naming supported tags                                                                                                                                                                               |
| Scroll detection               | `core/src/useIntersection.svelte.ts` — `default: true` (assume intersecting → no first-paint float flash), observer `disconnect` on destroy                                                                                                                                                                                 |
| Registration                   | `core/src/user-components/tags/filter_bar/user-component.ts` — `{schema, Component}` triple                                                                                                                                                                                                                                 |
| Docs / intent                  | `docs/components/filter_bar.mdx` — "floating bar of filters at the top or bottom of your page" (impl is top-only); `docs/changelog.mdx` ~line 1284 — the float-on-scroll behavior is the point: bugfix entry "filter bar not floating on scroll in published pages"                                                         |
| Data model / pipeline          | n/a — presentational container; children bind filters themselves                                                                                                                                                                                                                                                            |
| Persistence of state           | n/a — the inputs' own URL params carry state; the bar stores nothing                                                                                                                                                                                                                                                        |
| Empty / error / loading        | n/a — no states of its own; a bar with zero children renders an empty sticky strip                                                                                                                                                                                                                                          |
| Accessibility                  | n/a — plain divs; `aria-hidden="true"` only on the sentinel                                                                                                                                                                                                                                                                 |
| Edge cases it handles          | initial `isIntersecting` default prevents float flash; margins align sentinel exit with the dock offset                                                                                                                                                                                                                     |

## Trade-offs and what we adopt

| Axis                 | Options seen (repo → approach)                                                                                                                                                        | Trade-off                                                                                                                     | Our choice, and why                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Dock offset          | evidence → `sticky top-4` · ours → `sticky top-16` convention (`NavToc`, `features/chrome/nav-toc.tsx`)                                                                               | `top-4` hides the bar under our `sticky top-0 h-12` header (`src/web/src/App.tsx`)                                            | `top-16` — clears the 48px header, matches the chrome's existing convention                                          |
| Sentinel margins     | evidence → `-mt-4 mb-4` paired to `top-4`                                                                                                                                             | the sentinel must exit the viewport exactly when the bar reaches its dock line, or the card style fires early/late            | port the pairing: `-mt-16 mb-16` with `top-16`; zero-height `aria-hidden` div, `default: true` intersecting          |
| Float tokens         | evidence → `bg-background border-border shadow` shadcn tokens                                                                                                                         | our theme has no `background`/`border` aliases                                                                                | our chrome palette: `bg-white dark:bg-neutral-950`, `border-neutral-200 dark:border-neutral-800`, `shadow` (App.tsx) |
| z-index              | evidence → `z-50`                                                                                                                                                                     | ours stacks `z-20` header, `z-30` overlay, `z-40` sidebar (App.tsx); the bar docks below the header's band, never over it     | `z-10` — above page widgets scrolling under it, nothing more                                                         |
| Children enforcement | evidence → compile-time `invalid-child` Markdoc error vs our options: (a) runtime allowlist vs the 7 input components via `collectItemChildren`-style check + `WidgetError`, (b) none | our engine has no child-tag validation; the children aren't carriers so there's no correctness need (Row/Stack take anything) | (b) none — presentational container, minimum code; page authors get a free-form wrap and the browser renders it      |
| Top/bottom placement | evidence docs claim "top or bottom"; impl is `top-4` only                                                                                                                             | a `position` prop would invent API surface evidence doesn't implement                                                         | top-only, no prop — the tag's document position is the placement                                                     |

## Gap analysis — what we already have vs the references

| Concern              | Ours today (file)                                                                                                                                  | Best reference (file)                            | Gap                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| The container widget | absent — `mdxComponents` in `src/web/src/features/pages/markdown-page.tsx` has no `FilterBar`                                                      | `evidence/.../filter_bar/FilterBar.svelte`       | absent                                                                                          |
| Scroll detection     | `src/web/src/features/chrome/nav-toc.tsx` creates an inline `IntersectionObserver` (scroll-spy); no reusable hook                                  | `evidence/core/src/useIntersection.svelte.ts`    | partial — observer precedent exists inline; no sentinel/isIntersecting primitive                |
| Observer test stub   | `src/web/src/features/chrome/intersection-observer.stub.ts` (`stubIntersectionObserver`, used by nav-toc unit tests)                               | —                                                | complete — reusable (cross-feature import or relocation, dep-cruise only guards lib wrap sites) |
| Container idiom      | `src/web/src/features/widgets/markdown/{row,stack}.tsx` children + `cn`; `WidgetError` in `states.tsx`; `collect-children.ts` for carrier children | `evidence/.../filter_bar/`                       | complete as pattern — the new widget sits in `features/widgets/inputs/`                         |
| Float styling tokens | header/chrome palette exists (`App.tsx`, `nav-toc.tsx`)                                                                                            | `evidence` shadcn `bg-background border-border`  | partial — remap to `bg-white dark:bg-neutral-950` etc.                                          |
| Inputs to wrap       | all 7 shipped (`src/web/src/features/widgets/inputs/`; SL-010 `Dropdown`/`MultiSelect`, SL-011 the rest)                                           | evidence `allowedChildren` list                  | complete                                                                                        |
| Demo grouping        | `pages/weekly-review.md` lines 20–30 spread the 5 inputs across sections; `pages/nested/allocation.md` lines 23–25                                 | evidence pages wrap inputs in `{% filter_bar %}` | absent — inputs must be regrouped inside `<FilterBar>`                                          |

## Deviations

- Dock offset `top-16` (not `top-4`): our `h-12` sticky header plus the NavToc convention; sentinel margins scale to match (`-mt-16 mb-16`).
- Float style uses our chrome palette (`bg-white dark:bg-neutral-950`, `border-neutral-200 dark:border-neutral-800`, `shadow`); evidence's shadcn `bg-background`/`border-border` aliases don't exist here.
- `z-10`, not `z-50`: the bar docks below the header band and only needs to clear scrolling page content.
- No children allowlist: evidence's `allowedChildren` is a compile-time feature of its schema system (`process-markdoc.ts`); ours is a presentational wrap like `<Row>` — no enforcement. If T1 finds this hurts authoring, add a runtime `WidgetError` check as a deviation from this deviation.
- No `position`/`bottom` prop: evidence's docs claim top-or-bottom but the impl is top-only.
- `componentWrapper`/schema/`allowedChildren` machinery is not ported — our MDX layer has no equivalent.
- The component lives in `src/web/src/features/widgets/inputs/` (input-family container, evidence `category: 'input'`), not `widgets/markdown/`.

## Open decisions

- Children enforcement lean (none) — confirmed at T1: the bar renders any children, no `WidgetError` check; the fallback stays unneeded.
- `stubIntersectionObserver` stays imported cross-feature from `features/chrome/` (precedent: `details.unit.test.tsx` → `match-media.stub`); it gained a `fire(isIntersecting?)` mode fabricating one entry per observed target — the no-arg form still serves nav-toc.

## Surface

| Layer  | Files                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| engine | none — the MDX map is client-side (`markdown-page.tsx`)                                                                                                                                                |
| client | new `src/web/src/features/widgets/inputs/filter-bar.tsx` (+ `FilterBarProps` in `inputs/types.ts`); sentinel observer inline or a colocated `use-is-intersecting.ts` hook                              |
| ui     | `src/web/src/features/pages/markdown-page.tsx` `mdxComponents` entry; `pages/weekly-review.md` + `pages/nested/allocation.md` regrouped inputs                                                         |
| tests  | `filter-bar.unit.test.tsx` (stubbed observer), `filter-bar.stories.tsx`, `test/e2e-browser/filter-inputs.spec.ts` extension, `test/integration/features/filter-inputs.feature` compile-shape assertion |

## Tasks

One TDD unit each, one conventional commit each.

- [x] T1 — `<FilterBar>`: `features/widgets/inputs/filter-bar.tsx` — sentinel div + `IntersectionObserver` (`default: true`), `sticky top-16 z-10` bar (`flex flex-row flex-wrap items-end gap-4`), `floating` state adds card tokens; `FilterBarProps` in `inputs/types.ts`. Unit tests with `stubIntersectionObserver` (renders children, not floating initially, floats on sentinel exit, unfurls on re-entry) + `filter-bar.stories.tsx` (scrollable story; call `get-storybook-story-instructions` first per ADR-0006).
- [ ] T2 — demo + wiring: `mdxComponents` entry; regroup `pages/weekly-review.md` inputs into `<FilterBar>` (keep `## Overview` heading semantics intact) and `pages/nested/allocation.md`'s two inputs; extend `test/e2e-browser/filter-inputs.spec.ts` (scroll → float class via `eval`, params still write while pinned) + `filter-inputs.feature` compile shape; `playwright-cli` pass per `prompt-execution.md` §5 (measure: dock offset 64px, float transition, `console` clean) → backlog row → ship demo.

## Out of scope

- A dismissable chips strip of active filters — that is not what evidence's `filter_bar` is; the chips pattern lives under `table_filter` (`FilterChips.svelte`), catalogued `later`.
- Bottom-anchored or `position`-prop variants — evidence's impl is top-only.
- `clear all`/reset controls — evidence's bar has none.
- Cross-filter integration (`Coordinator`/`Selection` clauses) — R2/SL-013.
- `DateGrainSelector`, `ComparisonSelector`, `TableFilter` — the other `allowedChildren` inputs; widget-catalog `later`.
