# ADR-0036 — The chart-library fixes ship as a Vite plugin

Status: accepted
Date: 2026-11-09
Relates to: [ADR-0001](0001-record-architecture-decisions.md)

## Context

The SPA bundles echarts and zrender, and two behaviours of version 6.1.0 break it. A heatmap unmounted mid-paint runs a pending `_paintList` continuation after `Painter.dispose` and reads the nulled layer stack. A brush that restyles series through `updateVisual` leaves hovered bars grey after the brush is cleared, because that path skips the `clearStates`/`updateStates` wrap that `renderSeries` applies. Both are fixed by a short edit to one file each: `echarts/lib/core/echarts.js` and `zrender/lib/canvas/Painter.js`. Neither is fixed on the libraries' main branches.

The fixes were pnpm `patchedDependencies`. pnpm applies a patch while it installs inside this repository, so a project that runs `npm i @biac/cli` or `pnpm add @biac/cli` receives the unpatched libraries and `biac build` and `biac dev` bundle them as they are. The facts that bind the design, measured on 2026-11-09 against the packed package:

- The installed `node_modules/echarts` and `node_modules/zrender` are 6.1.0 without the fixes, and the built bundle lacks the zrender line.
- A package that ships both libraries as `bundledDependencies` weighs 13,473,617 B packed, 65,698,047 B unpacked, 2,085 files; the package without them weighs 330,381 B packed.
- A copy of the patched `lib/` directories under the package weighs about 997,485 B gzipped and needs aliases for five echarts subpaths and for zrender.
- Vite 8 bundles dependencies for the dev server with rolldown, outside `plugins`; `optimizeDeps.rolldownOptions.plugins` is the hook that reaches that step ([Vite dependency pre-bundling](https://vite.dev/guide/dep-pre-bundling)).
- The anchor line of each fix survives in an already patched file, so applying the plugin and a pnpm patch together would insert each fix twice.

## Decision drivers

- A consumer's `biac build` and `biac dev` carry the fixes without any install step, because pnpm blocks install scripts by default.
- The tarball stays small.
- A new echarts or zrender release that moves the code the fix is anchored to fails loudly instead of dropping the fix.
- The two libraries' licences are honoured where their code is modified.

## Options considered

| Option                                                      | Pro                                              | Con                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| pnpm `patchedDependencies` (before)                         | Declared in one place                            | Applied only by an install inside this repository                                     |
| `bundledDependencies` of patched copies                     | Reaches consumers                                | 41 times the tarball; `npm ls` reports a modified library as an unmodified `6.1.0`    |
| Patched `lib/` directories copied into the package          | Reaches consumers                                | About 1 MB, frozen at 6.1.0, five aliases to maintain, carries the libraries' licence |
| A postinstall script that patches `node_modules`            | Small                                            | pnpm ignores install scripts unless allowed; a consumer would run code on install     |
| A Vite plugin for `transform` and the dependency pre-bundle | 675 B; patches dev and build; checks its anchors | The anchor text must be updated when a release moves it                               |

## Decision

The two fixes are applied by `src/web/vite-plugins/chart-source-fixes.ts`, registered in `src/web/vite.config.ts` both in `plugins` (for `vite build`) and in `optimizeDeps.rolldownOptions.plugins` (for the dev dependency pre-bundle), and the pnpm `patchedDependencies` and the `patches/` directory are removed.

`patchChartSource(code, id)` matches a module by its path below `node_modules/` and inserts the fix around one anchor line. It throws naming the file and the anchor when the anchor is not found exactly once, and throws when the file already holds the fix, so a drifted library or a leftover patch is an error at build time. The plugin file's header names echarts (Apache-2.0) and zrender (BSD-3-Clause), the change made to each, and the condition for dropping it, which satisfies the licences' requirement to state that a file was changed. Storybook loads `src/web/vite.config.ts`, so its stories render with the same fixes.

## Consequences

- A consumer's install carries the fixes: they live in the package's own `src/web` and run whenever the SPA is bundled.
- An echarts or zrender upgrade that moves an anchor stops `biac build` and `biac dev` with a message naming the file; whoever upgrades updates the anchor or deletes the fix once upstream has it.
- The fixes are verified in the dev pre-bundle (`node_modules/.vite/deps`) and in the `vite build` bundle by their code, not their comments: both bundlers drop the comments.
- A new bundling entry point that does not go through `src/web/vite.config.ts` (a second Storybook builder, a library build) must register the plugin itself, or it ships the unfixed libraries.
