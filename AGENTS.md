## Docs map

Start at **`docs/backlog.md`** — it routes everywhere else and names the next slice to execute.

| Kind                              | Where                                                                         | Lifetime                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| What to build next                | `docs/backlog.md` — the milestone → slice ledger                              | Edited in place, never appended to                                         |
| How to build one capability       | `docs/slices/SL-NNN-*.md` (start from `docs/slices/_TEMPLATE.md`)             | **Ephemeral** — written when the slice is picked up, deleted when it ships |
| Which reference repos have what   | `docs/research/feature-census.md` — all 4, by feature area                    | **Ephemeral** — phase-scoped                                               |
| What is shipped but not usable    | `docs/research/usability-audit.md` — measured `GAP-NNN` rows                  | **Ephemeral** — deleted when every gap is closed                           |
| Why the system is shaped this way | `docs/adr/` (MADR) and `docs/architecture.md` (+ `docs/architecture/`, arc42) | Durable                                                                    |

Rules this repo is strict about — the first two are `docs/adr/0001-record-architecture-decisions.md`:

- **Durable docs never cite `research_repos/`.** Reference implementations are construction scaffolding; scaffolding comes down. A durable doc must still be true and useful if every reference repo vanished. Cite real sources of truth instead — a published spec, an upstream issue, an API contract, a file in `src/`.
- **Slice PRDs are where the evidence lives**, densely: cross-repo comparisons, `research_repos/` paths, trade-offs. They die with the slice.
- **`research_repos/` is read-only and untracked.** Every entry is a foreign checkout — a clone of someone else's repo; the directory is gitignored, so it never enters this repo's history. Read it for evidence — never edit, install, import, link, vendor, or commit it. The `AGENTS.md` and skill files inside those repos govern work inside them, not in this one.

A PRD exists so the session that executes it **never guesses and never assumes**. It owes three things, and is not ready without them: a row for **every one of the 4 feature reference repos** saying whether it has the feature (a capability most of them have is probably worth building; one none of them have is an invention and must be justified); an **implementation inventory** of the actual files to open per repo, grouped by concern, so the executing agent reads the real code and chooses rather than taking one repo's word; and a **gap analysis** of our own code against those references, file against file. Where two repos disagree, that disagreement is the decision the slice must make, and the PRD names it.

**Code comments follow the durable rule.** A comment states its fact so it stands alone. It may cite an ADR or a real source of truth; it must never cite a slice code (`SL-003`, `T4`) or a planning document — those do not outlive the work. Gate results go in the commit body, never in a doc.

A slice is one user-visible capability crossing engine → client → UI, closed by a demo a human runs (`docs/adr/0002-vertical-slices.md`). Never cut a slice horizontally.

## Token efficiency

- **Grep first, then read only the lines you need.** Never read a whole doc or source file to find one fact; `docs/backlog.md` lists the greps for ids, files and open work.
- **Search yourself; don't delegate lookups.** Spawn agents or workflows only when the user asks. A handful of greps is cheaper, and returns paths you can verify.
- **Measure instead of speculating.** One command that prints the number beats a paragraph reasoning about it. Keep output small: `-l`, `head`, `--include`, and exclude `node_modules`/`dist`/`research_repos`.
- **Let the gates be quiet.** They print their summary on a pass and everything on a failure; don't pipe them through `head`, which truncates failures too. `pnpm jscpd:report` locates the clones a failed `pnpm jscpd` only counted, and `--coverage.reporter=text` names the file behind a coverage total. `pnpm -s <script>` drops pnpm's two-line banner; `pnpm gate` runs the whole gate fail-fast, cheapest step first.
- **Write docs to be grepped.** Don't hard-wrap paragraphs; one fact per table row; stable ids (`ADR-NNNN`, `SL-NNN`, `GAP-NNN`); file names in full.

## Host resources

<!-- host-resources v1: a standard block, kept word-for-word identical wherever it is used. Limits specific to this repository go under "In this repository", below it. -->

This repository can share its host with other work, and hosts differ. Act on what you measure on the host in front of you, never on a core count, memory size or timing remembered from another run or written in a doc.

**Measure before every heavy command**: a test suite, a coverage or mutation run, a build, a browser, an emulator, a container.

```sh
nproc; cut -d' ' -f1-3 /proc/loadavg                # logical cores; 1, 5 and 15 min load
grep -E 'MemAvailable|SwapFree' /proc/meminfo       # memory a new process can still get
grep some /proc/pressure/cpu /proc/pressure/memory  # avg60: % of the last minute tasks stalled
findmnt -no FSTYPE -T "${TMPDIR:-/tmp}"             # tmpfs: the temp dir is RAM
```

These are Linux's commands; on another OS take the same four readings with its own tools.

- **Wait when the host is busy.** A 1 min load above `nproc` means more runnable tasks than cores, so one more job only lengthens every queue. A memory `some avg60` above zero on two readings a minute apart means tasks already stall for memory. Wait and measure again; if it stays that way, report the readings.
- **Fit the job to the memory.** Start a job only when its measured peak fits in `MemAvailable`. `/usr/bin/time -v <command>` prints `Maximum resident set size` for the largest single process of a run; multiply it by the number of workers.
- **Cap parallelism yourself.** A tool's `auto` worker count takes every logical core. Pass an explicit count of at most half of `nproc`: logical cores usually come two to a physical core, and the rest of the host needs the other half.
- **One heavy command at a time.** Queue the next one; never start two together.
- **Bound and contain every heavy command.** When the host has a job runner (`command -v devjob`), run through it: `devjob <command>`. Otherwise run `nice -n 10 timeout <limit> <command>`, so the job yields the CPU and cannot hang forever.
- **Stop what you start, in the step that finishes with it**: dev servers, browsers, emulators, daemons, containers, watchers. Then list what is left (`pgrep -af <name>`) and stop only processes this session started. One whose parent is alive and is not yours belongs to someone else.
- **Keep bulk off a RAM temp dir.** When the temp dir is `tmpfs`, every byte in it is memory until it is deleted. Installs, virtualenvs, downloaded binaries and large logs go to a path `findmnt -T <path>` shows on a disk filesystem, and you delete them when the task ends.
- **Re-run a failure alone before calling it a regression.** A timeout on a loaded host measures the neighbours. Measure again, run the test by itself, then judge.
- **Never relieve pressure by force.** Do not kill a process you did not start, raise a limit or switch off a cap to get a job through. Report the readings and wait.

### In this repository

- `pnpm gate` and `pnpm test:e2e-browser` run inside `scripts/run-capped.sh` — a systemd user scope with nice, a CPU weight (every idle core, yielding under contention), memory and runtime caps that kills whatever a run leaves behind, and that stays inside `devjob`'s limits when started under it; playwright runs 2 workers and vitest half the cores. Never run two gates at once, re-run a load-induced failure alone before calling it a regression, and stop every dev server and `playwright-cli` session you start.
- `pnpm typecheck` and `pnpm lint` keep their caches in `node_modules/.cache/` (`tsc --incremental` build info, `eslint --cache`): only changed files and their dependents are re-checked, with the same output as an uncached run — measured 2026-10-11, including on a cross-file type break and a new lint violation; warm runs 6.4 s and 3.1 s against 28.8 s and 33.0 s. The ESLint cache is safe only while no rule reads other files (no type-aware or import-graph rules today); adding one means dropping `--cache`. `rm -rf node_modules/.cache/tsc node_modules/.cache/eslint` forces a cold run.

## Manual check — strict

Every session ends with a `playwright-cli` pass over the real running app (`bin/biac dev`): headless (the default — never `--headed`), named session (`-s=<name>`); `goto`/`snapshot`/`click`/`resize` the screens the change touched, `screenshot` each screen change and read it, `eval` for `aria-*`/href/count assertions, `console` stays clean. Screenshots and the `.playwright-cli/` directory are scratch — `close` the session and delete it; never commit them. Full rule: `prompt-execution.md` §5.

## Code style

- Functions: 4-20 lines. Split if longer.
- Files: under 500 lines. Split by responsibility.
- One thing per function, one responsibility per module (SRP).
- Names: specific and unique. Avoid `data`, `handler`, `Manager`.
  Prefer names that return <5 grep hits in the codebase.
- Types: explicit. No `any`, no untyped functions.
- Type aliases shared across more than one module inside a component live in
  `<component>/types.ts` and are imported from there — never redefined locally.
- No code duplication. Extract shared logic into a function/module.
- Early returns over nested ifs. Max 2 levels of indentation.
- Exception messages must include the offending value and expected shape.
- Tests follow the triple-A pattern (Arrange, Act, Assert), grouped by scope.

## Comments

- Keep your own comments. Don't strip them on refactor — they carry
  intent and provenance.
- Write WHY, not WHAT. Skip `// increment counter` above `i++`.
- Docstrings on public functions: intent + one usage example, JSDoc conventions.
- Reference issue numbers / commit SHAs when a line exists because
  of a specific bug or upstream constraint.

## Dependencies

- Inject dependencies through constructor/parameter, not global/import.
- Wrap third-party libs behind a thin interface owned by this project —
  `.dependency-cruiser.cjs` enforces the wrap sites (`@base-ui/react` and
  `lucide-react` behind `src/web/src/components/`, `echarts` behind
  `features/widgets/charts/`, `codemirror` behind `features/editor/`,
  `shiki` behind `features/pages/`, `@duckdb/duckdb-wasm`/`apache-arrow`
  behind `features/data/`, `clsx`/`tailwind-merge` behind `lib/cn.ts`).
- Install only safe, official, well-maintained packages; pin exact versions
  (`save-exact`), respect `minimumReleaseAge`/`trustPolicy`. Reference repos
  are never dependencies.

## Structure

- `src/engine/` — node-side page pipeline (MDX compile, page manifest, vite plugin). No DOM, no web imports.
- `src/cli/` — `biac dev|build|preview`; `src/cli/main.ts` is the composition root.
- `src/web/` — the SPA (browser only): `components/` (wrapped primitives), `features/` (pages, widgets, filters, crossfilter, data, editor), `lib/`.
- `pages/` — the example project served to users (`.md` pages + `data/` files).
- `test/` — `integration/` (+ `features/` cucumber), `e2e/`, `e2e-browser/`, `lib/` shared helpers.
- Prefer small focused modules over god files; package by component, flat.
- Every UI component ships a colocated `<name>.stories.tsx` — the browser-true validation surface ([ADR-0006](docs/adr/0006-component-stories-are-the-ui-validation-surface.md)). Provider needs go through `src/web/.storybook/decorators.tsx`; Storybook binds port 6175 (never 6006) and its MCP server (`biac-storybook`, `.devin/mcp_config.json`) is the planning/validation entry point. `test/e2e-browser/storybook-stories.spec.ts` sweeps every story for console errors.
- Ports are interfaces in the component's `types.ts` (a `Context.Tag` under
  Effect) and exist only where a real boundary is crossed — an interface with
  no implementation and no consumer is deleted, not kept as scaffolding.

## Formatting

- Prettier (`pnpm format`). Don't discuss style beyond that.

## Logging

- Structured JSON when logging for debugging / observability.
- Plain text only for user-facing CLI output.
