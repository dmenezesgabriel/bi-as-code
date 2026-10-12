# ADR-0013 — A docked `<FilterBar>` is one row and opens its inputs on demand

Status: accepted
Date: 2026-10-12

## Context

`<FilterBar>` lays a page's filter inputs out as one wrapping row and sticks under the page header once the reader scrolls past it (`src/web/src/features/widgets/inputs/filter-bar.tsx`). At rest the bar is page content and its height costs nothing. Docked it is content laid over the page, and it was as tall as its inputs: on `pages/weekly-review.md` (five inputs) the docked bar covered 258 of 720 px at a 1280 px wide viewport and 434 of 812 px at 375 px, hiding the top of every chart under it, and its card padding re-wrapped the inputs so the page jumped 68 px at the dock moment.

WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum, level AA) requires that a component receiving keyboard focus is not entirely hidden by author-created content, and lists a sticky band hiding focused elements as failure F110 ([Understanding SC 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)). Its note 2 lets content the user opened cover other content, provided the user can dismiss it without moving focus.

The inputs' own popups — a dropdown's option list, the date picker — are already portaled to `<body>`.

## Decision drivers

- A docked bar never hides a large share of the viewport, at any width.
- The filters stay reachable while reading, exactly where a long page needs them.
- Nothing moves at the dock moment: not the page, not the reader's focus.
- An input keeps its selection and its option query whether shown or hidden.

## Options considered

| Concern                         | Option                                                            | Pro                                                            | Con                                                                                          |
| ------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| What the docked bar shows       | Every input, wrapping                                             | Zero clicks to a filter                                        | Unbounded height: 36 % of the viewport at 1280 px, 53 % at 375 px                            |
| What the docked bar shows       | Nothing below a breakpoint — the bar stops docking when narrow    | No overlay on a phone                                          | Filters unreachable while reading, and the problem is not narrow-only (36 % at 1280 px)      |
| What the docked bar shows       | One non-wrapping row that scrolls sideways                        | Fixed height, zero clicks for the first inputs                 | Hidden inputs have no affordance; a titled slider row is still tall                          |
| What the docked bar shows       | **One `Filters` trigger; the inputs open on demand**              | Fixed height at every width; one click to any filter           | One click more than at rest; a collapsed bar does not show that a filter is applied          |
| Trigger semantics               | A dialog (`aria-haspopup="dialog"`, focus trap, portal)           | Familiar popover behaviour                                     | The inputs' popups are already portaled and would nest inside a focus trap                   |
| Trigger semantics               | **A disclosure** (`button` + `aria-expanded` + `aria-controls`)   | The lightest correct semantics; the inputs stay where they are | No focus trap: dismissal rules are ours to write                                             |
| Hidden inputs                   | Unmount them                                                      | Nothing hidden in the DOM                                      | Each remount drops the input's cross-filter client and re-runs its option query              |
| Hidden inputs                   | **Keep them mounted, `hidden`**                                   | Selections and queries survive; not focusable, not read        | —                                                                                            |
| Page flow when the bar shrinks  | Let the page close up                                             | No extra element                                               | A sticky bar is in flow: the page jumps, the dock sentinel swings back, the faces oscillate  |
| Page flow when the bar shrinks  | **Hold the height it gave up in a sibling spacer**                | The document's scroll height is the same in every face         | A viewport resize while docked keeps the last rest height until the bar next rests           |
| What collapses the opened bar   | The trigger only                                                  | The disclosure pattern as written                              | The card stays open over the charts the reader opened it to change                           |
| What collapses the opened bar   | **The trigger, `Escape`, and a press on the page around the bar** | Closes at the natural moment; `Escape` meets SC 2.4.11 note 2  | A press must be told apart from one in an input's portaled popup                             |
| A bar that docks holding focus  | Collapse it like any other                                        | One rule                                                       | Hides the control the reader is using under them — SC 2.4.11 again                           |
| A bar that docks holding focus  | **Dock it opened**                                                | Focus is never hidden or dropped                               | A reader who scrolls with focus in the bar gets the card, not the row, until they dismiss it |
| Height of the opened docked bar | Unbounded                                                         | Every input visible at once                                    | Brings the 53 % band back on demand                                                          |
| Height of the opened docked bar | **Half the viewport, scrolling inside itself**                    | The report stays readable beside the open card                 | Inputs past the fold of the card need a scroll                                               |

## Decision

A docked `<FilterBar>` is a single fixed-height row holding a `Filters` disclosure trigger, and it shows its inputs only when the reader opens it; at rest it is unchanged and shows every input with no trigger.

The trigger follows the [WAI-ARIA APG Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) through the `Collapsible` wrap in `src/web/src/components/collapsible.tsx`. The rules, and where each lives:

- **One row** — docked, the bar is `2.5rem` tall (`DOCKED_ROW_HEIGHT` in `filter-bar.tsx`): a 24 px trigger (WCAG 2.5.8) with breathing room. The opened inputs are an absolutely positioned card under the row, so opening changes no flow.
- **Constant flow height** — `useRestingHeight` in `src/web/src/features/widgets/inputs/use-resting-height.ts` keeps the bar's rest height in state and a sibling spacer holds `rest − 2.5rem` in the same render as the docked face. Sizing the spacer from a layout read between the two DOM writes was measured and rejected: the browser's scroll anchoring moved the page by the difference.
- **Opened state** — `useDockedDisclosure` in `src/web/src/features/widgets/inputs/use-docked-disclosure.ts`. A bar docks collapsed unless focus is inside it — in an input or in an input's portaled popup, followed through React's focus events, which bubble through portals — in which case it docks opened, decided in the render that docks it. Returning to rest forgets the state; nothing is persisted.
- **Dismissal** — `useDockedDismissal` in `src/web/src/features/widgets/inputs/use-docked-dismissal.ts`. `Escape` collapses the bar and returns focus to the trigger. It is heard on `window`, after the popups' own `document` listeners, so an `Escape` that closed an option list does not also collapse the bar. A pointer press collapses the bar only when it lands inside the bar's app root — its top-level ancestor under `<body>` — and outside the bar (`isOutsidePress`); a press outside the app root is in a portaled popup and is left alone.
- **Bound** — row, gap and card together never exceed half the viewport height (`OPENED_PANEL_BOUNDS` in `filter-bar.tsx`); the card scrolls inside itself.

The bar takes no prop for any of this.

## Consequences

- A page with any number of inputs costs one row while scrolling, at every viewport width.
- Reaching a filter while scrolled costs one click more than at rest. Tests and demo scripts that drive an input on a scrolled page open `Filters` first.
- A collapsed docked bar would hide that a filter is applied, so the trigger counts the applied inputs (`Filters · 2`); no count at zero. Applied is `Filter.isApplied` in `src/web/src/features/filters/filter.ts`: a filter on a column counts while it has a predicate of its own published, and a filter read through `{{params.id}}` alone counts while its value is not `undefined`, `null`, `""`, `[]` or `false`. So an author's `initialValue` counts, and neither a held value nor a URL param is enough by itself — an untouched range slider holds its bounds for display with no predicate, and a toggle switched off leaves `?id=false`. The count is the button's description (`aria-describedby`, "2 active"), never part of its name, which stays `Filters` in every state. The bar learns its members without reading children props: `usePageFilter` enlists each input's filter in the bar's `FilterRoster` (`src/web/src/features/filters/filter-roster.ts`), so an input that reaches its filter any other way is not counted. A `Filter` publishes its clause before it notifies its listeners, so a listener always reads the applied state of the write it is told about.
- Collapse is decided by the docked state alone, never by viewport width. Making it "mobile only" would bring back the 36 % band at 1280 px.
- The disclosure is not a dialog on purpose. Turning it into a modal popover "for consistency" would nest the inputs' portaled popups inside a focus trap.
- `isOutsidePress` assumes popups are portaled to `<body>`, outside the app root. A popup rendered inside the app root but outside the bar would collapse the bar when pressed; such a popup must portal to `<body>` like the rest.
- The spacer keeps the last rest height while docked. After a viewport resize while docked the page's flow height is stale until the bar next comes to rest; re-measuring while docked would need the inputs laid out off-screen at their rest width.
