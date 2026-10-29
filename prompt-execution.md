# Execution session

You are starting a clean session with no memory of earlier ones. The repo's docs and git history are your memory. Follow these steps in order.

## 1. Orient — grep first, read only what you need

- Run `git log --oneline -15` and `git status --short`. Uncommitted or untracked work from an earlier session means that session stopped partway through. Understand it before starting anything new.
- Open `maintainer/backlog.md`. Its "Finding things" table lists the greps. Find the next slice with `grep -n "\*\*open ← next" maintainer/backlog.md`.
- If the next row is a research session (a docs-only `R<n>` milestone row), there is no PRD: its scope is its row in that milestone's ledger doc, and its output goes into `maintainer/research/`. It changes no `src/` file. Every number carries its command, every `research_repos/` path is checked with `test -e`, and every external claim carries a URL fetched in that session. The gate for a research session is `pnpm exec prettier --check` on the touched docs, and `git status --short -- src/` must be empty.
- Read that slice's PRD in `maintainer/slices/SL-NNN-*.md`. Find its first unchecked task with `grep -n "\[ \]" maintainer/slices/SL-NNN-*.md`.
- For the gaps the slice closes, grep them in the research ledgers: `grep -rn "GAP-001" maintainer/research/`.
- For a decision, grep the ADR id (`grep -rn "ADR-0001" maintainer/`) and read only that ADR.
- Follow `AGENTS.md`, token-efficiency section included. Do the searches yourself; spawn agents or workflows only if I ask.

## 2. Scope — one task per session

- Do **one task** (`T<n>`) of the slice, then stop. I open a new session for the next one. If a task is still too big, split it in the PRD first, then do the first piece.
- A slice is one user-visible capability crossing engine → client → UI, closed by a demo a human runs in the real app. Never cut it horizontally: a page pipeline with no route that serves it is not shipped. If it is too big, narrow the capability (one widget, one clause type, no options); never cut the stack.
- Finish what was started. Don't open a new slice while the current one is `open` or `partial`.

## 3. If the slice has no PRD, write it first

Copy `maintainer/slices/_TEMPLATE.md`. A PRD exists so whoever builds the slice never guesses and never assumes. It is not ready without these three sections:

- **Who else implements this:** a row for each of the 4 feature references in `research_repos/` — `evidence`, `framework`, `mosaic`, `streamlit` — including those that lack the feature. Start from `maintainer/research/feature-census.md`, then verify by reading code. A capability most of them have is probably worth building. One none of them have is an invention and must be justified.
- **Implementation inventory:** for every repo that has the feature, the actual files to open, grouped by concern (data model, pipeline, client, UI entry point, state persistence, empty/error/loading states, accessibility, edge cases). List paths, not summaries, so the builder reads every candidate implementation and chooses what suits us. Where two repos disagree, name the disagreement: it is the decision the slice must make.
- **Gap analysis:** our code against those references for the same feature, file against file. Say plainly whether ours is absent, unreachable, partial or complete.

Verify every path on disk in the session that writes the PRD. Symbol greps only find candidates; open the files before counting them. Cite paths and symbols. Add a `~N` line hint only if you checked it today. Tag each gap the slice closes with its `GAP-NNN`. Write the PRD to be grepped: no hard-wrapped paragraphs, one fact per table row, file names in full.

## 4. Build — strict TDD, evidence over assumption

- Before writing code, read how the reference repos named in the PRD solve the task, and take the best of them. Aim for the highest fidelity the references allow. Act on what you measured and read, never on assumption.
- Test-driven development on application source code, strictly: RED → GREEN → REFACTOR.
- Every new or refactored piece of application code gets unit tests, integration tests, e2e tests and a `playwright-cli` check in the real running app before you move on. Browser e2e may seed data through fixture files, but never the capability under test; that must be driven through the UI.
- Test the program's source code and its integrations with its production dependencies. Don't test devDependencies or conventions (e.g. whether `.gitignore` ignores `*.png`).
- No workarounds, no band-aids, no over-engineering, no dead code. Refactor carefully when the code needs it.
- A defect you introduce is yours to fix before you stop, whether or not it was planned.
- Code must be easy to read. Favour clarity and discoverability, use idiomatic names, and use the domain's ubiquitous language correctly.
- Use web search and `curl` when the references and official docs are not enough to settle a fact.
- Install only safe, official, well-maintained packages; guard against supply-chain attacks (`save-exact`, `minimumReleaseAge`, `trustPolicy`; install scripts stay blocked except an allowlist documented in `pnpm-workspace.yaml`). Reference repos are read-only: never install, import, link or vendor them.
- A new or changed UI component gets a colocated `<name>.stories.tsx` beside its `<name>.tsx` — every meaningful state, `storybook/test` play functions for interactions, provider needs via `src/web/.storybook/decorators.tsx`, never a real backend (`FakeDuckDb`). Details: [ADR-0006](maintainer/adr/0006-component-stories-are-the-ui-validation-surface.md).
- A new or changed `docs/` reference page gets its Storybook MDX docs page in the same task: `<Meta of>` the component's stories, a `<Canvas of>` per documented example, section for section with the `docs/` page ([ADR-0006](maintainer/adr/0006-component-stories-are-the-ui-validation-surface.md)).

## 5. Validate like a human would — `playwright-cli`, every session, no exceptions

- Every session ends with a `playwright-cli` pass over the real running app (`bin/biac dev`). The session that wrote the code runs it itself — this pass is not optional and not delegated. Use a named session (`-s=<name>`).
- Headless is `playwright-cli`'s default: never pass `--headed`, never `BROWSER=` opens. The browser is a person's desktop too.
- Interact with the page, don't just look at it: `goto` every changed route, `snapshot` for element refs, `click`/`fill`/`resize` the states you touched, `eval` for attribute and state assertions (`href`, `aria-*`, element counts).
- `screenshot` every step that changes the screen, and read the screenshots. Screenshots are for your analysis only; never commit them. The session writes a `.playwright-cli/` artifact directory — close the browser (`close`) and delete the directory when the pass ends.
- Measure; don't eyeball. For any layout or interaction you touch, record numbers before and after: rows visible, target sizes, `aria-*` state, `console` output (must stay clean — a tracked Known-debt entry like the `/favicon.ico` 404 is named, not hidden), query latency for interactions (cross-filter re-query time).

### Storybook — planning and validation for UI work

- Storybook binds **port 6175, never 6006** — other projects' instances live there and a sweep against the wrong build passes on foreign stories. `pnpm storybook` already bakes the port in; overrides go through `BIAC_STORYBOOK_PORT` (dev server) and `BIAC_STORYBOOK_URL` (the sweep spec).
- Plan with the MCP server (`biac-storybook`, configured in `.devin/mcp_config.json`, serving `http://localhost:6175/mcp`): call `get-storybook-story-instructions` before writing or editing stories — its output is authoritative for imports, story shape and play conventions — and `docs-list`/`docs-show` for what the catalog already covers.
- Validate with `stories-changed` + `stories-preview` after any UI-visible change, and include the returned preview URLs in your final message. `stories-find-by-component` maps a component file to the stories that exercise it.
- The gate is `test/e2e-browser/storybook-stories.spec.ts`: playwright's `webServer` starts Storybook, the spec walks every story id in `/index.json`, waits for each render's terminal phase on `window.__STORYBOOK_PREVIEW__.storyRenders` (so play failures count), and fails on any unexpected console error. Expected error-state noise goes in `INTENTIONAL_ERROR_STATE_STORIES`, framework noise in `KNOWN_NOISE` — each entry with a dated comment naming what fires it.

## 6. Close the step

- Run the full gate (`pnpm gate`) and put the results in the **commit body**, never in a doc: typecheck, lint, lint:style, format:check, knip, dep:cruise, jscpd, unit, web-unit, integration, e2e, cucumber, e2e-browser, plus the `playwright-cli` pass from §5.
- Commit each step or subtask with a conventional commit.
- Update the PRD's checkbox and the backlog ledger by **editing** them: one line per slice, no appended corrections, no dated blocks.
- When a `GAP-NNN` is closed and re-measured, mark it closed in the research ledger that holds it (`grep -rln "GAP-NNN" maintainer/research/`).
- When the slice ships (its demo run by a human), delete its PRD. Anything worth keeping becomes an ADR or a code comment first. Code comments state their fact so it stands alone. They may cite an ADR or a real source of truth, never `research_repos/`, a slice or task id, or a planning doc.
- Stop, and tell me what shipped, what you measured, and what the next task is.

## Reference repositories — `research_repos/`, 4 feature references, read-only and untracked

| Repo        | What it is for us                                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evidence`  | BI-as-code product: ` ```sql name ` inline queries, `{% tag %}`/`data="name"`/`filters=[...]`/`{{param}}` UX, Filter model + URL persistence, ~75 widget tags, ECharts usage |
| `framework` | Markdown pages + client-side DuckDB-WASM SQL blocks (`id=`/`display` directives), `sql:` front-matter, Inputs, file-based routing, static builds, data loaders               |
| `mosaic`    | Cross-filter architecture: `Coordinator`, `Selection`/`SelectionClause`, `wasmConnector`, `makeClient`, spec YAML — we port the semantics, never install it                  |
| `streamlit` | Widget UX catalog: `lib/streamlit/elements/widgets/` — behavior/empty-state/a11y reference for inputs                                                                        |
