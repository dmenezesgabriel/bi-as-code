# ADR-0014 — Theme colours are CSS custom properties, authored in hex

Status: accepted
Date: 2026-10-15

## Context

Every surface, text and border colour in the SPA was a raw Tailwind palette utility (`bg-white`, `text-neutral-600`, …) paired with a `dark:` twin, and the ECharts theme in `src/web/src/features/widgets/charts/theme.ts` hand-copied the same tones as a hex table. Changing one tone meant editing every file that used it and the chart table separately; nothing kept them equal.

Dark mode is class-strategy: `src/web/index.html` sets `.dark` on `<html>` before first paint and `src/web/src/features/chrome/use-theme.ts` toggles it. Charts render to a canvas, so they cannot inherit CSS colours; whatever the chart theme reads must be a string ECharts can parse. ECharts draws through zrender, whose `parse` in `zrender/lib/tool/color.js` (6.1.0) accepts hex, named colours, `rgb(a)` and `hsl(a)` — not `oklch()`, the format Tailwind 4's palette is written in.

## Decision drivers

- One place to change a colour, for the chrome, every widget and the charts alike.
- The first paint is already in the right mode; the token mechanism must not add a frame in the wrong one.
- The canvas chart theme can consume the same values without a conversion step.
- A token is found with one grep.

## Options considered

| Option                                                                                          | Pro                                                                                                                  | Con                                                                         |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| CSS custom properties on `:root` and `.dark`, mapped to utilities by Tailwind's `@theme inline` | No build or emit step; the existing pre-paint `.dark` script keeps working; Storybook's `.dark` toggle picks them up | The canvas chart theme must read the values back with `getComputedStyle`    |
| A TypeScript theme object emitted as CSS and passed to the chart theme                          | The chart theme gets values directly                                                                                 | Needs an emit step or a runtime `<style>` that must land before first paint |
| Tokens in `oklch`, matching Tailwind 4's palette                                                | Same colour space as the palette                                                                                     | zrender cannot parse them; every chart read needs a converter               |
| Muted tones derived from two bases by `color-mix()`                                             | Fewer values to keep                                                                                                 | Not greppable; `color-mix()` is not parsable by zrender either              |

## Decision

Theme colours are CSS custom properties defined on `:root` (light) and `.dark` in `src/web/src/styles.css`, each listed explicitly in hex, and exposed as Tailwind utilities through `@theme inline` (`--color-<name>: var(--<name>)`).

Names follow the shadcn/ui set (`background`, `foreground`, `muted`, `muted-foreground`, `accent`, `border`, `ring`, `sidebar`, …) because that vocabulary is what Tailwind users already read; a tone the set does not name gets its own token (`separator`, `indicator`, `border-strong`, `muted-foreground-faded`) rather than being merged into a near neighbour. Components use the semantic utilities with no `dark:` twin: the token carries both values.

## Consequences

- Restyling a tone is one edit in `styles.css`, in each mode.
- Values are hex even though Tailwind's palette is `oklch`. This is not an oversight to "modernise": an `oklch` token would silently drop out of every chart that reads it. Each hex value is the sRGB rendering of the Tailwind tone it replaced, so the page looks the same.
- A colour that varies by mode is added as a token, never as a `dark:` utility.
- Alpha tints stay as Tailwind opacity modifiers on a token (`bg-sidebar-accent/60`) rather than as extra tokens.
