# ADR-0002 — A slice is a user-visible capability; a layer-only slice is not a slice

Status: accepted
Date: 2026-10-03

## Context

This product is built by agents in clean sessions, so work decomposes into small units. Decomposing by layer — "add the pipeline module", then "add the route", then "add the widget" — produces units that each pass their own gate while the sum delivers nothing a user can reach. The failure is silent: nothing is red, and there is no entry point.

## Decision drivers

- "Shipped" has to mean a user can do something new.
- Every layer passing its own gate says nothing about whether they connect.

## Options considered

| Option                                 | Pro                                | Con                                                           |
| -------------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Layer slices                           | Each unit is small and homogeneous | Value arrives only when the last layer lands, if it ever does |
| One big feature                        | Guaranteed to connect              | Too large for one session; no intermediate feedback           |
| Vertical slice, narrowed by capability | Always demoable; still small       | Each unit touches the whole stack, so it needs breadth        |

## Decision

A slice is **one user-visible capability**, crossing engine → client → UI in a single unit of work.

A slice that is too large is narrowed by **reducing the capability** — one widget type, one clause type, no options — and never by cutting the stack horizontally.

Every slice carries a **demo**: a numbered script a human runs from a cold start. A slice is `shipped` only after that demo has been run. Otherwise it is `partial`, and must name the missing entry point.

**Detector, since the failure is silent:** a browser end-to-end spec that reaches past the UI to seed the capability it is testing is proof the entry point is missing. Such a spec may seed _data volume_ through fixtures, but never the _capability under test_.

## Consequences

A slice is broader than a layer unit and touches unfamiliar parts of the stack. That is the cost, and it is the point: the connection between layers is the thing most likely to be missing, so it must be inside the unit of work.

Groundwork with no user-visible surface is part of the slice that first exposes it, not a slice of its own.
