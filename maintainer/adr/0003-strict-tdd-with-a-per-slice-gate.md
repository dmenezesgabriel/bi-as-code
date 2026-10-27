# ADR-0003 — Strict test-first development, with a full gate per slice

Status: accepted
Date: 2026-10-03

## Context

This codebase is written almost entirely by agents, one slice per session, with no shared memory between sessions. The usual safeguards against drift — a person who remembers why something is the way it is, and notices when a change smells wrong — are not available. The test suite and the static gates are the only continuity between sessions.

A passing unit suite is also demonstrably insufficient: a control can render and do nothing, a dev server can resolve the wrong root, a layout can nest its scroll container wrongly — none visible to a unit test.

## Decision drivers

- No human reviewer holds context between sessions.
- Different classes of defect are only visible to different tiers.
- A gate that can be skipped will be skipped under time pressure.

## Options considered

| Option                                       | Pro                                        | Con                                                                                |
| -------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Tests after implementation                   | Feels faster                               | Tests written to match the code, including its bugs; untestable designs land first |
| Unit tests only, gates in CI                 | Fast loop                                  | Misses integration, rendering and interaction defects entirely                     |
| Strict test-first plus a full per-slice gate | Catches each defect class at its own level | Slower per slice, and genuinely demanding                                          |

## Decision

Every slice is built **test-first**: the smallest failing test, the minimum code to pass it, then refactoring with the tests green. Each such unit is one conventional commit.

Rules that make it real: never two units in flight at once; never start the next unit while the current one fails validation; if decomposition uncovers hidden complexity, decompose further.

Before a slice closes, the full gate runs — unit, web-unit, integration, end-to-end, cucumber, browser-e2e, then manual verification, then the static gates (types, lint, style, formatting, knip, dependency boundaries, duplication, coverage). No tier is skipped.

The **manual tier is mandatory and is not an assertion tier.** A human drives the real running application in a real browser and confirms the slice's demo. It exists to catch exactly what a green suite cannot, and a slice is not closed until it has been run.

Gate results are recorded in the **commit body**, not in a document.

## Consequences

Slices are slower than they would be otherwise; that is the price of having no reviewer with memory, paid knowingly.

Test-first pressure shapes the design toward injected dependencies and small pure modules.

A defect found while working on something else is fixed rather than noted. The gate is the mechanism that keeps that from accumulating.

Because gate results live in commit messages, the quality history is queryable from git and never drifts from the code it describes.
