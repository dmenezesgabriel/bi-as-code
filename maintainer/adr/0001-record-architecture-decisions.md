# ADR-0001 — Record architecture decisions

Status: accepted
Date: 2026-10-03

## Context

This codebase is written by agents, one slice per session, with no shared memory between sessions. Decisions made in conversation evaporate; decisions made in code look arbitrary to the next session and get "fixed". A decision record is the only durable place "why" can live.

Two kinds of knowledge compete for the same documents. Durable knowledge — why the system is shaped this way — must still be true next year. Construction evidence — which reference file proved what — rots within weeks as reference checkouts move.

## Decision drivers

- A future reader must be able to follow a decision without access to any reference repository.
- Evidence gathered for a slice is real and dense, but has the shelf life of the slice.

## Options considered

| Option                      | Pro                                                              | Con                                                         |
| --------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| One running NOTES.md        | Cheap                                                            | Unbounded, ungrepable, dies of noise                        |
| ADRs + ephemeral slice PRDs | Durable "why" is findable; evidence dies with the work it served | Two places to write                                         |
| Everything in ADRs          | One place                                                        | Construction scaffolding never comes down; ADRs rot with it |

## Decision

Architecture decisions are recorded as MADR files under `maintainer/adr/`, numbered `ADR-NNNN`. An ADR is written when a decision is made, marked `accepted`, and amended only via a new ADR that supersedes it.

**Durable documents never cite `research_repos/`.** An ADR cites real sources of truth — a published spec, an API contract, an upstream issue, a file in `src/` — so it stands alone if every reference checkout vanished. Cross-repo evidence lives in the slice PRD (`maintainer/slices/`) that consumed it, and the PRD is deleted when the slice ships.

Code comments follow the same rule: they state a fact that stands alone, may cite an ADR or a real source of truth, and never cite a slice or task id or planning document.

## Consequences

Decisions stay discoverable via `grep -rn "ADR-NNNN" maintainer/ src/`. The cost is duplicated writing — once in the PRD where evidence belongs, once in the ADR where the decision lives — paid knowingly to keep durable docs durable.
