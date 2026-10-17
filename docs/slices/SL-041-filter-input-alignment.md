# SL-041 — Filter inputs share one label row and one control height

Milestone: Phase 2 — A polished UI · State: open · Depends on: — · Closes: GAP-030

## Outcome

A reader scanning a `<FilterBar>` sees every input's label on one line and every control box on one line, the same height, with the `<Toggle>` sitting on that control line instead of floating between rows.

## Demo

1. Cold start: `bin/biac dev`, open `http://localhost:<port>/weekly-review` at 1280 px.
2. Overview filter bar: the `Region`, `Amount`, `Ordered` and `Search regions` label tops are equal (today `Amount` sits 8 px higher), and the `Region`, `Ordered` and `Search regions` controls and the `Large orders only` box are one height with equal tops and bottoms.
3. Scroll until the bar docks, open `Filters`: the same two lines hold inside the opened panel.
4. Resize to 375 px: inputs wrap one per row, and each input's label sits the same distance above its control.
5. Open `/nested/allocation`: the `Channel` button group and multi-select labels share a top, and their controls share a height before any chip is picked.
6. Pick three channels in the multi-select: its label does not move.

## Baseline (measured 2026-10-16, `bin/biac dev`, `playwright-cli` `eval` of `getBoundingClientRect()`, page-y px)

| Screen                                           | Labels (top)                                                                        | Controls (top / height / bottom)                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `/weekly-review` resting, 1280 px (row 1)        | `Region` 513, `Amount` 505, `Ordered` 513                                           | `Region` 537/32/569, `Ordered` 537/32/569                   |
| `/weekly-review` resting, 1280 px (row 2)        | `Search regions` 585                                                                | `Search regions` 609/32/641, `Large orders only` 605/36/641 |
| `/weekly-review` docked panel, 1280 px           | `Region` 1628, `Amount` 1620 (row 1); `Ordered` 1700, `Search regions` 1700 (row 2) | 32 px controls; toggle 36 px on its own row                 |
| `/weekly-review` docked panel, 375 px            | one input per row, label-to-control gap 4 px on every labelled input                | 32 px controls; toggle 36 px                                |
| `/nested/allocation`, 1280 px, nothing picked    | `Channel` button group 373, `Channel` multi-select 379                              | button group 397/34/431, multi-select 403/32/435            |
| `/nested/allocation`, 1280 px, 3 channels picked | button group 389, multi-select 373 (16 px apart)                                    | button group 413/34/447, multi-select 397/54/451            |

The 1280 px resting bar wraps into two rows. Absolute tops sit 33 px lower than GAP-030's audit numbers, and the deltas hold (`Amount` 8 px high). The toggle box's top is 4 px **above** the search input's, with equal bottoms. Console: 0 errors, 0 warnings on both pages.

## Who else implements this

| Repo      | Has it  | Entry points                                                                                                                                                                           | Approach in one line                                                                                                                                                                                                                                                                                                                                          |
| --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | FULL    | `research_repos/evidence/core/src/user-components/tags/filter_bar/FilterBar.svelte`, `research_repos/evidence/core/src/shadcn/components/ui/input/input.svelte`                        | Bottom-aligned bar (`items-end`); every tag is `flex flex-col` with `Label class="mb-2"`, then its control in a `mt-auto` box with a fixed bottom margin; controls are `h-9` (36 px); the slider calibrates its label gap (`mb-[12.5px]`); the toggle has no label row and sits on the control line                                                           |
| framework | PARTIAL | `research_repos/framework/package.json` (`@observablehq/inputs`), `research_repos/framework/src/rollup.ts`, `research_repos/framework/docs/inputs/toggle.md`                           | Inputs come from the `@observablehq/inputs` dependency, whose CSS is not in the clone: one row per input, label in a fixed `--label-width: 120px` column left of a `--input-width: 240px` control, `min-height: 25.5px`, the toggle's label in the same column (https://raw.githubusercontent.com/observablehq/inputs/main/src/style.css, fetched 2026-10-16) |
| mosaic    | ABSENT  | `research_repos/mosaic/packages/vgplot/inputs/src/Menu.js`, `research_repos/mosaic/packages/vgplot/inputs/src/Search.js`, `research_repos/mosaic/packages/vgplot/inputs/src/Slider.js` | Appends a bare `<label>` and a native control per input; no shared height or alignment, so nothing to port                                                                                                                                                                                                                                                    |
| streamlit | FULL    | `research_repos/streamlit/frontend/lib/src/theme/primitives/sizes.ts`, `research_repos/streamlit/frontend/lib/src/components/widgets/BaseWidget/styled-components.ts`                  | One `minElementHeight: 2.5rem` (40 px) for every control, a label row with `minHeight: fontSizes.xl` + `marginBottom: twoXS` that `labelVisibility="hidden"` keeps reserved; checkbox and toggle have no label row and get column-alignment margins to meet the control line                                                                                  |

**Count:** 3 of 4 give a row of inputs one label line and one control line. It is worth building. The two that ship a styled toggle (evidence, streamlit) keep it labelless and align it to the control line. Framework gives it a label column, but its layout is label-left, which our bar is not.

## Implementation inventory

### evidence

| Concern             | Files                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row container       | `research_repos/evidence/core/src/user-components/tags/filter_bar/FilterBar.svelte` (`flex flex-row flex-wrap items-end gap-4`)                                                                                                                                                                                                                                                                                                                    |
| Label row           | `research_repos/evidence/core/src/shadcn/components/ui/label`; `Label class="mb-2"` in `research_repos/evidence/core/src/user-components/tags/text_input/TextInput.svelte`, `research_repos/evidence/core/src/user-components/tags/dropdown/Dropdown.svelte`, `research_repos/evidence/core/src/user-components/tags/button_group/ButtonGroup.svelte`, `research_repos/evidence/core/src/user-components/tags/range_calendar/RangeCalendar.svelte` |
| Control height      | `research_repos/evidence/core/src/shadcn/components/ui/input/input.svelte` (`h-9`), `research_repos/evidence/core/src/shadcn/components/ui/button/button.svelte` (`default: h-9`, `sm: h-8`), `research_repos/evidence/core/src/shadcn/components/ui/select/select-trigger.svelte`, `research_repos/evidence/core/src/user-components/tags/button_group/ButtonGroup.svelte` (`'h-9'` items)                                                        |
| Control bottom line | the `mt-auto mb-3 pb-1` control wrapper in `TextInput.svelte`, `ButtonGroup.svelte`, `Toggle.svelte`; `mb-4` in `Dropdown.svelte`, `RangeCalendar.svelte`                                                                                                                                                                                                                                                                                          |
| Toggle              | `research_repos/evidence/core/src/user-components/tags/toggle/Toggle.svelte`: an `h-9 w-fit` bordered box, inline `Label`, `Switch`, no label above                                                                                                                                                                                                                                                                                                |
| Slider              | `research_repos/evidence/core/src/user-components/tags/slider/Slider.svelte`: `Label class="mb-[12.5px] ... w-64"` with `min-height: 1.25rem`, track + min/max below, wrapper `mb-4`                                                                                                                                                                                                                                                               |
| Accessibility       | `Label for={id}` on every tag; the toggle's label wraps the switch's id                                                                                                                                                                                                                                                                                                                                                                            |
| Edge cases          | the slider's skeleton keeps the label row's `1.25rem` height while loading                                                                                                                                                                                                                                                                                                                                                                         |

### framework

| Concern           | Files                                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency        | `research_repos/framework/package.json` (`"@observablehq/inputs": "^0.12.0"`)                                                                                                                  |
| CSS namespace     | `research_repos/framework/src/rollup.ts` (`__ns__` → `inputs-3a86ea`)                                                                                                                          |
| Layout and toggle | upstream `src/style.css` (URL above): `form.__ns__ { display: flex; align-items: center; min-height: 25.5px }`, `--label-width: 120px`, and `form.__ns__-toggle > label { align-self: start }` |
| Usage             | `research_repos/framework/docs/inputs/toggle.md`, `research_repos/framework/docs/inputs/index.md`, `research_repos/framework/docs/inputs/form.md`                                              |

### streamlit

| Concern           | Files                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size tokens       | `research_repos/streamlit/frontend/lib/src/theme/primitives/sizes.ts` (`minElementHeight: "2.5rem"`, `smallElementHeight: "1.5rem"`)                                                                                                                                                                                                                                   |
| Label row         | `research_repos/streamlit/frontend/lib/src/components/widgets/BaseWidget/styled-components.ts` (`StyledWidgetLabel`), `research_repos/streamlit/frontend/lib/src/components/widgets/BaseWidget/WidgetLabel.tsx`, `research_repos/streamlit/frontend/lib/src/util/utils.ts` (`LabelVisibilityOptions`)                                                                  |
| Control height    | `research_repos/streamlit/frontend/lib/src/components/widgets/TextInput/styled-components.tsx` (`height: minElementHeight`), `research_repos/streamlit/frontend/lib/src/components/widgets/DateInput/styled-components.ts` (`height`), `research_repos/streamlit/frontend/lib/src/components/widgets/Multiselect/styled-components.ts` (`minHeight`, so chips grow it) |
| Slider            | `research_repos/streamlit/frontend/lib/src/components/widgets/Slider/styled-components.ts` (track padded to `minElementHeight`)                                                                                                                                                                                                                                        |
| Toggle / checkbox | `research_repos/streamlit/frontend/lib/src/components/widgets/Checkbox/styled-components.tsx` (`fieldStyles` `minHeight: smallElementHeight`), `research_repos/streamlit/frontend/lib/src/components/widgets/Checkbox/Checkbox.tsx`                                                                                                                                    |
| Row alignment     | `research_repos/streamlit/frontend/lib/src/components/core/Block/styled-components.ts` (`CHECKBOX_WRAPPER_SELECTOR` gets `spacing.sm` margins under top and bottom column alignment)                                                                                                                                                                                   |

**Disagreements:** control height is 36 px (evidence) vs 40 px (streamlit) vs 25.5 px min (framework). The toggle is labelless on the control line (evidence, streamlit) vs in the label column (framework). The slider is calibrated to fit the row (evidence) vs padded to the control height (streamlit).

## Trade-offs and what we adopt

| Axis               | Options seen (repo → approach)                                                                    | Trade-off                                                                                                         | Our choice, and why |
| ------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------- |
| Control height     | evidence → 36 px; streamlit → 40 px; ours → 32 px                                                 | 36 px matches our toggle's `h-9` already; 40 px matches our `DOCKED_ROW_HEIGHT` but grows the bar by 8 px per row | open decision 1     |
| Toggle             | evidence, streamlit → labelless on the control line; framework → label column                     | a label row above the toggle would repeat its inline label                                                        | open decision 2     |
| Slider fit         | evidence → calibrated label gap; streamlit → track padded to control height                       | evidence's numbers stay right only while the label row's line-height does                                         | open decision 3     |
| Alignment rule     | evidence → `items-end` + fixed control bottom margin; streamlit → fixed label row + top alignment | bottom alignment lets a growing multi-select push its own label up                                                | open decision 3     |
| Where sizing lives | evidence → classes repeated per tag; streamlit → shared theme tokens                              | per-widget classes drift (they already have: 32 vs 36 px)                                                         | open decision 4     |

## Gap analysis — what we already have vs the references

| Concern        | Ours today (file)                                                                                                                                                                        | Best reference (file)                                                | Gap                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Row container  | `src/web/src/features/widgets/inputs/filter-bar.tsx` (`flex flex-row flex-wrap items-end gap-4`, docked panel same classes)                                                              | evidence `FilterBar.svelte`                                          | same rule; partial: nothing gives every child the same bottom margin                                                |
| Label row      | `mb-1 block ... text-sm font-medium text-label` in `text-input.tsx`, `date-range.tsx`, `select-fields.tsx`, `button-group.tsx`; `slider.tsx` label row is a flex row with the live value | streamlit `StyledWidgetLabel`                                        | partial: same classes, written four times, no reserved height                                                       |
| Control height | `h-8` in `text-input.tsx`, `date-range.tsx`, `select-fields.tsx` trigger, `button-group.tsx`; `min-h-8` in the `select-fields.tsx` multi `InputGroup`; `h-9` in `toggle.tsx`             | evidence `input.svelte`, streamlit `sizes.ts`                        | partial: two heights in one row                                                                                     |
| Toggle         | `src/web/src/features/widgets/inputs/toggle.tsx` (`h-9` box, inline label, no label row)                                                                                                 | evidence `Toggle.svelte`, streamlit `Checkbox/styled-components.tsx` | partial: labelless like both, bottom on the control line, but 36 px tall against 32 px neighbours (top 4 px higher) |
| Slider         | `src/web/src/features/widgets/inputs/slider.tsx` `SliderField` (label + `mb-1` + 20 px control + `mt-1` min/max = 64 px), `PinnedSliderReadout` (`min-h-16`)                             | evidence `Slider.svelte`                                             | partial: bottom-aligned at 64 px against 56 px neighbours puts its label 8 px high                                  |
| Docked panel   | `filter-bar.tsx` opened `Collapsible.Panel` reuses the row classes                                                                                                                       | evidence `FilterBar.svelte` (one bar, no docked panel)               | inherits whatever the row gets                                                                                      |
| Geometry tests | `test/e2e-browser/filter-bar.spec.ts` (dock, page shift, 375 px fit; no label or control alignment)                                                                                      | —                                                                    | absent                                                                                                              |

**Verdict:** present and partial. Every input renders and is labelled, but nothing holds the label line and control line together. No ledger row claims this shipped.

## Deviations

None planned. Whichever rule is chosen gets a comment at the shared sizing point, stating the alignment it guarantees.

## Open decisions

1. **Control height**: 32, 36 or 40 px. Evidence for: our toggle and evidence use 36; streamlit uses 40 = `DOCKED_ROW_HEIGHT`. Measure the bar's resting height at 1280 and 375 px for each before choosing.
2. **Toggle label**: stay labelless on the control line (evidence, streamlit) or take a label row (framework). Default to the two-repo majority unless the screen says otherwise.
3. **Alignment rule**: keep `items-end` and fit the slider to the row (evidence), or switch to `items-start` with a fixed-height label row (streamlit). Check which keeps the multi-select's label still as chips wrap (demo step 6).
4. **Where the sizing lives**: one shared field shell (label row + control box) used by every input, or shared class constants in `inputs/` plus a geometry test. Pick the smaller diff that leaves one place to change the height.

## Surface

| Layer  | Files                                                                                                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | — (no MDX or manifest change)                                                                                                                                                           |
| client | —                                                                                                                                                                                       |
| ui     | `src/web/src/features/widgets/inputs/filter-bar.tsx`, `text-input.tsx`, `date-range.tsx`, `select-fields.tsx`, `button-group.tsx`, `toggle.tsx`, `slider.tsx`, and their `.stories.tsx` |
| tests  | `test/e2e-browser/filter-bar.spec.ts` (or a new `filter-bar-alignment.spec.ts`), `filter-bar.stories.tsx` play assertions                                                               |

## Tasks

- [ ] T1 — Measure: a browser spec asserting the label tops are equal and the control boxes share a height and bottom across the `/weekly-review` bar (resting, docked-open, 375 px) and `/nested/allocation`. RED against today's 480/480/472 and 32/36 px. Settle open decisions 1–3 from those numbers.
- [ ] T2 — One control height and one label row for the label-plus-control inputs (`text-input.tsx`, `date-range.tsx`, `select-fields.tsx`, `button-group.tsx`), from one shared source (open decision 4). Navigate `/weekly-review` and `/nested/allocation` and measure the control heights.
- [ ] T3 — `<Toggle>` on the control line. Navigate `/weekly-review` and measure the toggle box against `Search regions` (top, bottom, height).
- [ ] T4 — `<Slider>` (`SliderField` and `PinnedSliderReadout`) on the same label line, plus the multi-select's label held still as chips wrap. Navigate `/weekly-review` (`Amount`) and `/nested/allocation` (pick 3 channels) at 1280 and 375 px, docked panel open.

## Out of scope

- Input widths (`w-64` everywhere) and the bar's horizontal rhythm.
- Label typography or colour (SL-036 tokens own it).
- A `labelVisibility` prop: no reference demand from our pages.
