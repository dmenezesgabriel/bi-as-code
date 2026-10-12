# SL-022 — Every pager button and `<Details>` trigger is big enough to hit

Milestone: Phase 1 — A usable BI-as-code product · State: open · Depends on: — · Closes: GAP-015, GAP-016

## Outcome

A reader on a phone or with an imprecise pointer can page a `<Table>` (or a `display` SQL block result) and open a `<Details>` section without mis-hitting a neighbour: every one of those targets is at least 24×24 CSS px (WCAG 2.2 SC 2.5.8 Target Size (Minimum), https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Demo

1. Cold start: `pnpm build:cli && bin/biac dev`, open `http://localhost:5175/weekly-review` at 1280×900.
2. Scroll to **Order size** — the pager under the order-grain table: `First page`, `Previous page`, `Next page`, `Last page` each measure 24×24 (before: 22×22). Click `Next page` — `Page 2 of 36`. Repeat on **Quarter detail**'s pager.
3. Scroll to the `<Details>` stack under **Overview** — `Metric definitions`, `How the region filter works`, `Mobile summary` triggers each measure ≥ 24 px tall (before: 20 px). Click each — `aria-expanded` flips and the panel opens.
4. Resize to 375×800 — same sizes hold (before: pager 22×22, triggers 327×20); the pager still fits on one line beside `Page 1 of 36 · 355 rows`.
5. Toggle dark mode — hover and disabled states of the pager still read.
6. `bin/biac build && bin/biac preview` → `/weekly-review` — same measurements.

## Who else implements this

| Repo      | Has it  | Entry points                                                                                                                                                    | Approach in one line                                                                                                                                                            |
| --------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | PARTIAL | `evidence/core/src/user-components/tags/table/TablePaginationButton.svelte`, `evidence/core/src/user-components/tags/details/Details.svelte`                    | Pager: ghost icon button forced to `size-6` (24 px), 14 px icon, buttons adjacent with no gap — passes 2.5.8. Details: plain `text-sm` button, no min height — fails like ours. |
| framework | ABSENT  | `framework/docs/inputs/table.md`, `framework/src/style/layout.css`                                                                                              | `Inputs.table` scrolls instead of paginating; no page-level details widget (only the sidebar's `<summary>` styling).                                                            |
| mosaic    | ABSENT  | `mosaic/packages/vgplot/inputs/src/Table.js`                                                                                                                    | Table scroll-loads the next `offset`/`limit` batch on scroll; no pager, no disclosure widget.                                                                                   |
| streamlit | FULL    | `streamlit/frontend/lib/src/components/widgets/Pagination/styled-components.ts`, `streamlit/frontend/lib/src/components/elements/Expander/styled-components.ts` | Pager buttons 32 px (`spacing.threeXL`) with a 4 px gap; expander summary ≥ 24 px label (`iconSizes.xl`) + padding, 40 px (`sizes.minElementHeight`) in the default style.      |

**Count:** 2 of 4 have a pager, 2 of 4 have a disclosure widget; every one that has a pager makes its buttons ≥ 24 px. streamlit is the only reference whose disclosure trigger passes. The audit row for GAP-016 says "no reference does better" — true of evidence only; streamlit does.

## Implementation inventory

### evidence

| Concern                  | Files                                                                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI entry point — pager   | `evidence/core/src/user-components/tags/table/TablePagination.svelte` (button row: `flex items-center`, no gap), `evidence/core/src/user-components/tags/table/TablePaginationButton.svelte`                                            |
| Sizing                   | `TablePaginationButton.svelte`: `buttonVariants({ variant: 'ghost', size: 'icon', class: 'text-muted-foreground size-6' })` — `size-6` overrides the variant's `size-9` (`evidence/core/src/shadcn/components/ui/button/button.svelte`) |
| Accessibility specifics  | `aria-label={label}` + a tooltip with the same label; loading state swaps the icon for a spinner and disables the button                                                                                                                |
| UI entry point — details | `evidence/core/src/user-components/tags/details/Details.svelte` — `<button class="… flex shrink-0 cursor-pointer items-center gap-0.5 text-left text-sm">`, no min height                                                               |
| Tests                    | `evidence/core/src/user-components/tags/details/Details.svelte.test.ts` (open/openMobile semantics, no size assertion)                                                                                                                  |

### streamlit

| Concern                   | Files                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UI entry point — pager    | `streamlit/frontend/lib/src/components/widgets/Pagination/Pagination.tsx` (`role="navigation"`, `aria-label="Pagination"`, numbered buttons with `aria-current="page"`)                                                                                |
| Sizing                    | `streamlit/frontend/lib/src/components/widgets/Pagination/styled-components.ts` — `StyledPaginationButton`/`StyledArrowButton` `minWidth`/`height` `theme.spacing.threeXL`; group `gap: theme.spacing.twoXS`                                           |
| Theme tokens              | `streamlit/frontend/lib/src/theme/primitives/spacing.ts` (`twoXS` 4 px, `threeXL` 32 px), `streamlit/frontend/lib/src/theme/primitives/sizes.ts` (`minElementHeight` 2.5rem), `streamlit/frontend/lib/src/theme/primitives/iconSizes.ts` (`xl` 1.5rem) |
| UI entry point — expander | `streamlit/frontend/lib/src/components/elements/Expander/Expander.tsx` (native `<details>`/`<summary>`)                                                                                                                                                |
| Sizing — expander         | `streamlit/frontend/lib/src/components/elements/Expander/styled-components.ts` — `StyledSummaryLabelWrapper` `minHeight: theme.iconSizes.xl`; `getSummaryStyle` compact (4 px block padding) vs default (`minHeight` from `minElementHeight`)          |
| Tests                     | `streamlit/frontend/lib/src/components/widgets/Pagination/Pagination.test.tsx`, `streamlit/frontend/lib/src/components/elements/Expander/Expander.test.tsx`                                                                                            |

**Disagreement:** evidence sizes to the 2.5.8 floor (24 px, no gap); streamlit sizes above it (32 px + 4 px gap, expander 32–40 px). That is the decision below.

## Trade-offs and what we adopt

| Axis                       | Options seen (repo → approach)                                                  | Trade-off                                                                                                                                       | Our choice, and why                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pager button size          | evidence → 24 px; streamlit → 32 px                                             | 24 px meets 2.5.8 and keeps the `text-xs` pager row's height (22 → 24); 32 px adds 10 px per row and widens the button group by 40 px at 375 px | 24 px (`size-6`, centred icon), evidence parity — our pager is the same four-icon row as evidence's                                                     |
| Spacing between buttons    | evidence → none; streamlit → 4 px gap                                           | At 24×24 each target meets the size clause on its own, so 2.5.8 needs no spacing; a gap only helps above the minimum                            | No gap — adjacent 24 px targets pass                                                                                                                    |
| `<Details>` trigger height | evidence → `text-sm` line (≈ 20 px, fails); streamlit → ≥ 24 px label + padding | `min-h-6` reaches 24 px with no visible change to the title line; streamlit's bordered 40 px row is a different visual design                   | `min-h-6` on the trigger (streamlit's compact-style floor), keep evidence's look — a stack of three triggers grows from 60 to 72 px                     |
| How size is asserted       | neither reference asserts size in tests                                         | jsdom has no layout, so unit tests cannot measure; Storybook and playwright run a real browser                                                  | A playwright helper beside `test/e2e-browser/contrast.ts` measures `boundingBox()` against 24 px; story play functions assert the same box in Storybook |

## Gap analysis — what we already have vs the references

| Concern                          | Ours today (file)                                                                                                                                    | Best reference (file)                                    | Gap                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| Pager button size                | `src/web/src/features/widgets/table/data-table.tsx` `PagerButton`: `rounded p-1` around a 14 px icon (`src/web/src/components/icons.tsx`) → 22×22    | evidence `TablePaginationButton.svelte` `size-6` → 24×24 | Partial — 2 px short on both axes; GAP-015 |
| Pager reach                      | `TablePager` serves `<Table>` (`src/web/src/features/widgets/table/table.tsx`) and `display` SQL blocks (`src/web/src/features/pages/sql-block.tsx`) | —                                                        | One component — one fix covers both        |
| Pager accessibility              | `aria-label` + `title` per button, `disabled` at the ends                                                                                            | evidence: same label as tooltip                          | Complete                                   |
| `<Details>` trigger              | `src/web/src/features/widgets/markdown/details.tsx` `Collapsible.Trigger` `text-sm`, no min height → 20 px                                           | streamlit `Expander/styled-components.ts` ≥ 24 px        | Partial — 4 px short; GAP-016              |
| Size assertions                  | none — `test/e2e-browser/table-widget.spec.ts` and `test/e2e-browser/markdown-widgets.spec.ts` assert behaviour only                                 | none                                                     | Absent                                     |
| `<Accordion>`, `<Tabs>` triggers | 52 px and 32 px tall (measured, see baseline)                                                                                                        | —                                                        | Complete — not in scope                    |

Our implementation is **present and partial**: both widgets work and are labelled, and both miss the 24 px floor. The `shipped` claims for SL-004 and SL-008 survive; this is a measured usability shortfall, not a broken capability.

The audit row for GAP-015 lists `/crossfilter-scale`; that page has no table since SL-019 hid named SQL block output by default (ADR-0011), so today's instances are the two visible `/weekly-review` pagers (plus one inside an inactive tab panel).

Baseline, measured 2026-10-11 with `playwright-cli` on `bin/biac dev`, `getBoundingClientRect()`:

| Target                                             | 1280×900                              | 375×800          |
| -------------------------------------------------- | ------------------------------------- | ---------------- |
| Pager buttons, `/weekly-review` (2 visible pagers) | 8 of 8 at 22×22, adjacent (x step 22) | 8 of 8 at 22×22  |
| `<Details>` triggers, `/weekly-review`             | 3 of 3 at 688×20, stacked (y step 20) | 3 of 3 at 327×20 |
| `<Accordion>` triggers, `/weekly-review`           | 4 at 688×52                           | 4 at 327×52      |
| `<Tabs>` triggers, `/weekly-review`                | 56×32, 55×32                          | —                |
| Pagers on `/crossfilter-scale`                     | none rendered                         | —                |

## Deviations

None — both fixes are evidence/streamlit sizing on our own markup.

## Open decisions

None. 24 px over streamlit's 32 px is settled above; if a later audit targets SC 2.5.5 (Enhanced, 44 px) that is a new gap, not this slice.

## Surface

| Layer  | Files                                                                                                                                                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | none — pure UI sizing                                                                                                                                                                                                                                          |
| client | none                                                                                                                                                                                                                                                           |
| ui     | `src/web/src/features/widgets/table/data-table.tsx`, `src/web/src/features/widgets/markdown/details.tsx`                                                                                                                                                       |
| tests  | new `test/e2e-browser/target-size.ts` (helper), `test/e2e-browser/table-widget.spec.ts`, `test/e2e-browser/markdown-widgets.spec.ts`, `src/web/src/features/widgets/table/data-table.stories.tsx`, `src/web/src/features/widgets/markdown/details.stories.tsx` |

## Tasks

- [x] T1 — Pager buttons ≥ 24×24 (GAP-015). RED: add `test/e2e-browser/target-size.ts` (`expectMinTargetSize(locator, 24)` reading `boundingBox()`, message naming the measured box) and assert it on all four buttons of the `/weekly-review` order-grain pager in `test/e2e-browser/table-widget.spec.ts`; add a `data-table.stories.tsx` play assertion on the button box. GREEN: `PagerButton` → `inline-flex size-6 items-center justify-center` replacing `p-1`. `playwright-cli`: `/weekly-review` at 1280 and 375 px, 8 of 8 visible buttons 24×24, click `Next page` → `Page 2 of 36`, dark-mode hover/disabled screenshot; `/crossfilter-scale` unchanged. Close GAP-015 in `docs/research/usability-audit.md`.
- [x] T2 — `<Details>` trigger ≥ 24 px tall (GAP-016). RED: reuse `expectMinTargetSize` in `test/e2e-browser/markdown-widgets.spec.ts` on the three `/weekly-review` triggers; `details.stories.tsx` play assertion on the trigger box. GREEN: `min-h-6` on the `Collapsible.Trigger` in `details.tsx`. `playwright-cli`: 3 of 3 triggers ≥ 24 px tall at 1280 and 375 px, each toggles `aria-expanded`, `How the region filter works` still opens by default. Close GAP-016 (and correct its "no reference does better" note to cite streamlit).

## Out of scope

- Numbered page buttons and `aria-current="page"` (streamlit `Pagination.tsx`) — a pager feature, not a target-size fix; no gap tracks it.
- SC 2.5.5 Target Size (Enhanced, 44 px) — not an audit target.
- `<Accordion>`, `<Tabs>`, sidebar and filter-input targets — measured passing (or tracked elsewhere); not in GAP-015/GAP-016.
