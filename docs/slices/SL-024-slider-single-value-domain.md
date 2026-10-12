# SL-024 — A `<Slider>` whose source holds one value says so

Milestone: Phase 1 · State: open · Depends on: SL-011, SL-013 · Closes: Known-debt row "Cross-filtering `/weekly-review` to the **North** bar narrows the Amount slider's domain to one value … `max` must be greater than `min`" (`docs/backlog.md`); no `GAP-NNN` (the R3 audit is closed and deleted)

## Outcome

A reader who cross-filters a page until a slider's source holds a single value sees that value stated plainly — `Amount` and `40`, nothing to drag — and the console stays clean.

## Demo

1. Cold start: `pnpm build:cli` if `dist/cli/main.js` is older than `src/cli/`, then `bin/biac dev`; open `http://localhost:5175/weekly-review?region=North` at 1280×720.
2. The Amount input shows its label, the single value `40` and a note that only one value is in range — no thumbs, no `role="slider"` (`document.querySelectorAll('[role="slider"]').length` counts only other sliders on the page). The console has 0 warnings and 0 errors.
3. Pick `West` in Region: the two-thumb Amount slider returns with West's bounds; a keyboard step on `Minimum` writes `?amount=lo - hi`.
4. Open `http://localhost:5175/weekly-review` and click the **North** bar in Regional split: the Amount input turns into the same readout as step 2; the console stays clean.
5. Resize to 375×812 and repeat steps 1–2: the readout fits the filter bar without horizontal scroll (`document.documentElement.scrollWidth` is 375).
6. `bin/biac build` + `bin/biac preview` (`http://localhost:4173/weekly-review?region=North`): step 2 behaves the same.

## Who else implements this

No reference renders a single-value domain specially. Two of four derive slider bounds from data at all; one rejects equal bounds; none guards the primitive.

| Repo      | Has it                                                    | Entry points                                                                                                                                                                                                                                      | Approach in one line                                                                                                                                                                                                                |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | PARTIAL — data-derived, cascade-filtered bounds; no guard | `research_repos/evidence/core/src/user-components/tags/slider/Slider.svelte`, `research_repos/evidence/core/src/user-components/tags/slider/SliderFilter.svelte.ts`, `research_repos/evidence/core/src/shadcn/components/ui/slider/slider.svelte` | Re-queries `MIN`/`MAX` through the filter cascade and passes `{min}`/`{max}` straight to the bits-ui primitive — `min === max` reaches it unguarded, no `disabled`                                                                  |
| framework | PARTIAL — a slider input, author-supplied extent only     | `research_repos/framework/src/client/stdlib/inputs.js` (re-exports `range` from `@observablehq/inputs`, which is not installed in the checkout — its body cannot be read here)                                                                    | The page author passes a static `[min, max]`; bounds never come from data, so a cascade cannot collapse them                                                                                                                        |
| mosaic    | PARTIAL — data-derived bounds, queried once               | `research_repos/mosaic/packages/vgplot/inputs/src/Slider.js` (`query`, `queryResult`)                                                                                                                                                             | A native `<input type="range">`; `query` returns `null` once `this.min`/`this.max` are set, so bounds are frozen after the first result and the cascade never narrows them. `step = (max - min) / 500` would be `0` on equal bounds |
| streamlit | PARTIAL — rejects equal bounds                            | `research_repos/streamlit/lib/streamlit/elements/widgets/slider.py` (`StreamlitInvalidMinMaxError`), `research_repos/streamlit/frontend/lib/src/components/widgets/Slider/Slider.tsx`                                                             | `if min_value == max_value: raise StreamlitInvalidMinMaxError` — commented "The frontend will error if the values are equal"                                                                                                        |

**Count:** 0 of 4 render a collapsed domain; 3 of 4 have a data- or author-bounded slider that could reach it. The readout face is a small invention, justified by our live bounds cascade (SL-011/SL-013 semantics, ported from evidence) — which makes one-value domains a normal data state, not an authoring mistake.

## Implementation inventory

### evidence

| Concern               | Files                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bounds pipeline       | `research_repos/evidence/core/src/user-components/tags/slider/Slider.svelte` (MIN/MAX query, user-over-query precedence, `snapToStep`, ~1000-tick `step`) |
| Seed / clamp          | same file — `filter.setDefault`, clamp of URL value into `[min, max]`                                                                                     |
| UI entry point        | same file — two `<Slider {min} {max} {step}>` branches (range / single); `research_repos/evidence/core/src/shadcn/components/ui/slider/slider.svelte`     |
| Persistence of state  | `research_repos/evidence/core/src/user-components/tags/slider/SliderFilter.svelte.ts` (`"lo - hi"` codec)                                                 |
| Edge cases it handles | none for `min === max`                                                                                                                                    |

### framework

| Concern        | Files                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- |
| UI entry point | `research_repos/framework/src/client/stdlib/inputs.js` (re-export of `@observablehq/inputs`) |

### mosaic

| Concern               | Files                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Bounds pipeline       | `research_repos/mosaic/packages/vgplot/inputs/src/Slider.js` — `query` (`select min/max … where filter`), `queryResult` |
| UI entry point        | same file — constructor builds `<input type="range">`, sets `min`/`max`/`step` attributes                               |
| Edge cases it handles | bounds freeze after the first result — the cascade never collapses them                                                 |

### streamlit

| Concern                        | Files                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Validation                     | `research_repos/streamlit/lib/streamlit/elements/widgets/slider.py` — `min_value == max_value` raises |
| UI entry point                 | `research_repos/streamlit/frontend/lib/src/components/widgets/Slider/Slider.tsx`                      |
| Empty / error / loading states | the raised `StreamlitInvalidMinMaxError` is the only face for equal bounds                            |

**Disagreement:** evidence lets the domain collapse and hands it to the primitive; mosaic avoids the collapse by freezing bounds; streamlit rejects equal bounds. That is the decision this slice makes.

## Trade-offs and what we adopt

| Axis                                       | Options seen (repo → approach)                                                                         | Trade-off                                                                                                                         | Our choice, and why                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bounds that collapse under the cascade     | evidence → live, may collapse · mosaic → frozen after first query · streamlit → static, error on equal | Freezing hides how narrow the filtered data is and undoes shipped SL-011 behaviour; erroring treats a data state as an author bug | Keep evidence's live cascade (already shipped)                                                                                                                           |
| What a one-value domain renders            | evidence → primitive with `min === max` · mosaic → native input tolerates it · streamlit → error       | The primitive path is what fires Base UI's warning; a faked `max = min + step` lies in `aria-valuemax`                            | A static readout: label, the value, "only one value in range" — no Base UI root, no `role="slider"`, since nothing can be slid. Decided with the user in the PRD session |
| Author-pinned bounds (`min={40} max={40}`) | streamlit → error                                                                                      | An error would split one state into two code paths                                                                                | Same readout — equal bounds are valid whatever produced them. Decided with the user in the PRD session                                                                   |

## Gap analysis — what we already have vs the references

| Concern                     | Ours today (file)                                                                                                                                                | Best reference (file)                              | Gap                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detecting the collapse      | `src/web/src/features/widgets/inputs/slider.tsx` `Slider` — `pinned = bounds.min === bounds.max`                                                                 | none of the four detect it                         | complete                                                                                                                                                |
| Rendering the collapse      | `src/web/src/features/widgets/inputs/slider.tsx` `SliderField` — still renders `SliderPrimitive.Root` with `min === max`, disabled                               | evidence `Slider.svelte` (same defect)             | partial — `@base-ui/react@1.8.0` `slider/root/SliderRoot.mjs` warns `Slider \`max\` must be greater than \`min\`.`whenever`min >= max`, disabled or not |
| Bounds, seed, clamp, codec  | `src/web/src/features/widgets/inputs/slider-value.ts` (`resolveSliderBounds`, `clampSliderValue`, `sliderValueCodec`)                                            | evidence `Slider.svelte`, `SliderFilter.svelte.ts` | complete — no change                                                                                                                                    |
| Unit test of the collapse   | `src/web/src/features/widgets/inputs/slider.unit.test.tsx` "narrows the bounds source through the filters prop" — asserts a disabled thumb with `min`/`max` `99` | —                                                  | asserts the defect; must assert the readout                                                                                                             |
| Story of the collapse       | `src/web/src/features/widgets/inputs/slider.stories.tsx` `CascadedBounds` — asserts `max="20"` and a disabled thumb                                              | —                                                  | asserts the defect; no author-pinned story                                                                                                              |
| Story sweep                 | `test/e2e-browser/storybook-stories.spec.ts` collects only `error`-level console messages                                                                        | —                                                  | the warning passes the sweep unseen today — the slice's e2e must assert on `warning` itself                                                             |
| Browser e2e of the collapse | `test/e2e-browser/filter-inputs.spec.ts` covers the Amount slider writes, not the collapse                                                                       | —                                                  | absent                                                                                                                                                  |

Our implementation is **present and partial**: the state is detected and the value lifecycle is right; only the face is wrong. SL-011's `shipped` claim survives — the slider works; this closes its console-noise edge.

## Deviations

- The readout face exists in none of the references. It is stated in a code comment at the branch in `slider.tsx`; no ADR, since it changes no cross-widget contract.
- The readout shows the raw value, as the track-end labels do today — the slider has no `fmt` prop.

## Open decisions

None — both were settled with the user in the PRD session (see Trade-offs).

## Surface

| Layer  | Files                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| engine | —                                                                                                          |
| client | — (`src/web/src/features/widgets/inputs/slider-value.ts` unchanged)                                        |
| ui     | `src/web/src/features/widgets/inputs/slider.tsx`, `src/web/src/features/widgets/inputs/slider.stories.tsx` |
| tests  | `src/web/src/features/widgets/inputs/slider.unit.test.tsx`, `test/e2e-browser/filter-inputs.spec.ts`       |

## Tasks

- [x] T1 — Pinned readout. RED: in `slider.unit.test.tsx`, a collapsed cascade renders no `role="slider"`, shows the label and the value, and `console.warn` is called 0 times (spied); same for author-pinned `min={40} max={40}`. GREEN: a `PinnedSliderReadout` beside `SliderField` in `slider.tsx`, chosen when `pinned`; `SliderField`'s `disabled` drops `pinned`. The value lifecycle is unchanged (the silent seed still normalizes to `[v, v]` / `v` and publishes no clause — assert it). Stories: update `CascadedBounds`'s play, add `PinnedByProps`. E2E in `filter-inputs.spec.ts`: `/weekly-review?region=North` shows the readout with 0 console warnings matching `/max. must be greater than .min./`, and picking `West` brings back the `Minimum`/`Maximum` sliders. `playwright-cli`: demo steps 1–5, `eval` the `role="slider"` count and `scrollWidth` at 375 px, screenshot each state.
- [ ] T2 — After the human demo run: remove the Known-debt slider row from `docs/backlog.md`, mark SL-024 `shipped`, delete this PRD.

## Out of scope

- Value formatting (`fmt`) on `<Slider>` — no such prop exists; a later Platform/inputs slice.
- Freezing bounds after the first query (mosaic) — would undo shipped cascade semantics.
- Erroring on equal bounds (streamlit) — rejected above.
- Catching `warning`-level console output in the story sweep — a separate gate change, not this capability.
