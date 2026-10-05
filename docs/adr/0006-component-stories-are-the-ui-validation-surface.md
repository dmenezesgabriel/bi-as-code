# ADR-0006 — Component stories are the UI validation surface, served by one Storybook on a reserved port

Status: accepted
Date: 2026-10-05

## Context

UI components here are validated two ways: jsdom unit tests (behavior) and — until now — nothing that renders them in a real browser in isolation. The result: styling regressions, missing providers, and dead states are only caught when a full page happens to exercise the component, which is late and hard to attribute.

Storybook is already configured (`src/web/.storybook/`, `storybook dev` script) but had zero stories and zero addons. Components need providers (`DataRuntime`, `QueryRegistry`, TanStack Router) that a bare iframe does not supply, and this machine runs other projects' Storybook instances on the default port 6006 — a sweep that hit the wrong instance would pass against foreign stories.

## Decision drivers

- Every component needs a browser-true render check that fails fast and names the story.
- Stories must not require a live backend — `FakeDuckDb` covers the data port.
- The Storybook MCP endpoint (`@storybook/addon-mcp`) makes the catalog machine-readable, so an agent can plan and validate UI work without guessing story ids.
- Port collisions on a shared dev machine must be impossible.

## Options considered

| Option                                   | Pro                                                          | Con                                                                            |
| ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Stories + Playwright sweep over every id | Real browser, per-story error attribution, zero extra runner | One extra server in the browser test job                                       |
| `@storybook/addon-vitest` browser tests  | Stories double as a vitest project                           | Adds a second test runner tier the jsdom suite already covers; heavier tooling |
| Component pages inside the app itself    | No extra tooling                                             | Pollutes the product surface; no per-state catalog                             |

## Decision

Every UI component in `src/web/src/` gets a colocated `<name>.stories.tsx` beside its `<name>.tsx` and `<name>.unit.test.tsx`. Stories follow CSF3 with `Meta`/`StoryObj` from `@storybook/react-vite`, meaningful named states, and `storybook/test` play functions where behavior exists. Provider needs are met by shared decorators in `src/web/.storybook/decorators.tsx` (`withMemoryRouter`, `withDataRuntime`, `withQueryData`) — a story never talks to a real backend.

Storybook runs on **port 6175**, not the 6006 default (`pnpm storybook` bakes it in; `BIAC_STORYBOOK_PORT`/`BIAC_STORYBOOK_URL` override). `test/e2e-browser/storybook-stories.spec.ts` is the gate: it starts Storybook via playwright `webServer`, walks every story id from `/index.json`, waits for each render to reach a terminal phase on `window.__STORYBOOK_PREVIEW__.storyRenders`, and fails on any unexpected console error or pageerror.

`@storybook/addon-mcp` is registered in `main.ts` with `features.componentsManifest`, serving MCP at `/mcp` — `.devin/mcp_config.json` points the agent at it, and `prompt-execution.md` §5 makes `get-storybook-story-instructions` → `stories-changed` → `stories-preview` part of the UI-change workflow.

## Consequences

- A new component is not done until its story renders clean in the sweep; the sweep fails the suite on a single console error, so error-state stories must keep their noise in `INTENTIONAL_ERROR_STATE_STORIES`.
- Decorator order matters — Storybook composes story decorators with the last entry outermost — so decorators that nest dependent providers (`withQueryData`) own the whole provider subtree rather than relying on array order.
- The `favicon.svg` `<link>` lives in `.storybook/preview-head.html` because browsers request `/favicon.ico` for every iframe otherwise and the sweep reads it as an error.
- No `@storybook/addon-vitest`: the jsdom web-unit project already covers behavior; a browser test tier would duplicate it.
