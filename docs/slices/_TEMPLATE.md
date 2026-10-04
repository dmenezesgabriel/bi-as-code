# SL-0NN — <capability in the user's words>

Milestone: <name> · State: open | in-progress | partial | shipped · Depends on: SL-0MM | — · Closes: GAP-NNN | —

> Copy this file to start a slice. Delete it when the slice ships.
>
> A PRD exists so the executing agent **never guesses and never assumes**. If a decision can be settled by opening a reference file, this document says which file. Every path is verified on disk in the session that writes the PRD — line ranges rot, so cite paths, and add a line range only where a file is large and the range was checked today.

## Outcome

One sentence: what a user can do afterwards that they cannot do now.

## Demo

A numbered script a human runs from a cold start. The slice is not `shipped` until this has been run in the real app.

1. Cold start: `pnpm build && pnpm preview` (or `pnpm dev`), open `http://localhost:<port>/<page>`, …
2. …
3. Reload — the effect persists.

Write this PRD to be grepped: do not hard-wrap paragraphs, keep one fact per table row, write file names in full, and tag every gap it closes with its `GAP-NNN`.

## Who else implements this

**Every reference repo gets a row, including the ones that do not have it** — an absence across many products is evidence too, and a feature present in most of them is probably worth having. Start from `docs/research/feature-census.md`, then verify.

| Repo      | Has it              | Entry points   | Approach in one line |
| --------- | ------------------- | -------------- | -------------------- |
| evidence  | FULL/PARTIAL/ABSENT | `path`, `path` |                      |
| framework |                     |                |                      |
| mosaic    |                     |                |                      |
| streamlit |                     |                |                      |

**Count:** N of 4 implement this. <What that says about whether to build it.>

## Implementation inventory

For **every** repo marked FULL or PARTIAL above, the files an implementer must actually open — not a summary of them. Group by concern so a reader can jump to the one they are working on. The point is that the executing agent reads the real code and picks what suits us, rather than taking one repo's word for it.

### <repo name>

| Concern                        | Files |
| ------------------------------ | ----- |
| Data model / schema            |       |
| Pipeline / execution           |       |
| Client / state                 |       |
| UI entry point                 |       |
| Persistence of state           |       |
| Empty / error / loading states |       |
| Accessibility specifics        |       |
| Edge cases it handles          |       |

Repeat per repo. Note where two repos disagree — that disagreement is the decision the slice has to make.

## Trade-offs and what we adopt

One row per real decision. "Options seen" must come from the inventory above, not from imagination.

| Axis | Options seen (repo → approach) | Trade-off | Our choice, and why |
| ---- | ------------------------------ | --------- | ------------------- |

## Gap analysis — what we already have vs the references

Read our own code first. A slice that half-exists is worse than one that does not, and this is where that gets caught.

| Concern | Ours today (file) | Best reference (file) | Gap |
| ------- | ----------------- | --------------------- | --- |

State plainly whether our existing implementation is: absent · present but unreachable · present and partial · complete. If anything in the ledger claims `shipped` for part of this, say whether that claim survives.

## Deviations

Anything we will not port as-is, and why. A deviation that outlives the slice becomes an ADR; the rest is stated in a code comment at the point it applies.

## Open decisions

Anything the slice must settle that the references disagree on or none of them answers. Each needs evidence gathered before it is decided, and an ADR after.

## Surface

| Layer  | Files |
| ------ | ----- |
| engine |       |
| client |       |
| ui     |       |
| tests  |       |

## Tasks

One TDD unit each, one conventional commit each. Small enough that a unit takes well under an hour; if it does not, decompose further.

- [ ] T1 —
- [ ] T2 —

## Out of scope

What this slice deliberately does not do, and which slice or milestone owns it.
