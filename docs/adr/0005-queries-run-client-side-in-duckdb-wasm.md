# ADR-0005 — Queries run client-side in DuckDB-WASM; the build is a static site

Status: accepted
Date: 2026-10-03

## Context

Two execution models are available to a BI-as-code tool: a server executes SQL and ships rows to the client (requires a live backend), or the browser runs the database itself via `@duckdb/duckdb-wasm` (requires no backend at all once files are served).

The product's quality goals — works on any static host, zero infrastructure to deploy a report, fast local iteration — are best served by the in-browser model, and the requirement that `biac build` output be fully static makes it mandatory: with no backend at runtime, the query engine must live in the bundle.

## Decision drivers

- Static deployability: a report must work on any static host.
- DuckDB reads parquet/csv/json/arrow natively, which is exactly the file-register model pages declare.
- Cross-filtering re-issues queries per interaction; a local engine keeps round-trips at zero.

## Options considered

| Option                  | Pro                                         | Con                                                                                      |
| ----------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Server-side SQL engine  | No wasm bootstrap cost; warehouse reach     | Requires a backend at runtime; static build impossible without precomputing every result |
| Client-side duckdb-wasm | Zero runtime infra; real SQL in the browser | Wasm download + bootstrap latency; data files must be reachable over HTTP                |

## Decision

All page queries execute in `@duckdb/duckdb-wasm` inside the browser. Pages register tables from data files (parquet, csv, json, arrow) via the `sql:` front-matter key and project config; ` ```sql name ` fenced blocks define named queries resolved at render time against a query registry.

The dev server and static build both serve the project's `data/` files over HTTP; `biac build` copies them into `dist/` so a deployed report is self-contained. Remote database connectors (warehouse URLs) are a later milestone and do not change this decision — they are an additional source kind, not a different engine location.

`@duckdb/duckdb-wasm` is pinned to `1.32.0`: the `latest` dist-tag currently tracks a `-dev` prerelease, so `latest` is not a stable signal for this package.

## Consequences

- The DuckDB connection is a scoped resource owned by an Effect `Layer` (`features/data/`): init, worker lifecycle and teardown are explicit.
- Query cancellation matters: re-filter churn must interrupt in-flight work; the data port exposes cancellation, the coordinator uses it.
- Payload size (wasm ~10s of MB) is a real cost paid knowingly; measured in the data slice's demo.
- No server code paths for SQL exist to drift from the client path — one engine, one dialect.
