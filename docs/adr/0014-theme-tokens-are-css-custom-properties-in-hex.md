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

Theme colours are CSS custom properties defined on `:root, .light` (light) and `.dark` in `src/web/src/styles.css`, each listed explicitly in hex, and exposed as Tailwind utilities through `@theme inline` (`--color-<name>: var(--<name>)`).

Names follow the shadcn/ui set (`background`, `foreground`, `muted`, `muted-foreground`, `accent`, `border`, `ring`, `sidebar`, …) because that vocabulary is what Tailwind users already read; a tone the set does not name gets its own token (`separator`, `indicator`, `border-strong`, `muted-foreground-faded`) rather than being merged into a near neighbour. Components use the semantic utilities with no `dark:` twin: the token carries both values.

## Consequences

- Restyling a tone is one edit in `styles.css`, in each mode.
- Values are hex even though Tailwind's palette is `oklch`. This is not an oversight to "modernise": an `oklch` token would silently drop out of every chart that reads it. Each hex value is the sRGB rendering of the Tailwind tone it replaced, so the page looks the same.
- A colour that varies by mode is added as a token, never as a `dark:` utility.
- The chart theme reads the tokens back at chart init, through a hidden probe element classed `light` or `dark` under `<body>` (`src/web/src/features/widgets/charts/css-token-reader.ts`). The probe names its mode itself because a chart re-inits for a new mode before `<html>` changes class — React runs a child's effects before its parent's — which is why the light values are also selectable as `.light`. A token missing from the stylesheet throws, naming it, rather than painting an engine default.
- Alpha tints stay as Tailwind opacity modifiers on a token (`bg-sidebar-accent/60`) rather than as extra tokens. A tint that is solid in one mode and translucent in the other (the dark status washes) is a hex8 value in that mode's token instead.
- Status colours are one family per meaning, not one token per tone: `info`, `success`, `warning` and `destructive` each have `-surface`, `-border` and `-foreground` (callouts; error states reuse `destructive-*`), `positive` and `negative` colour deltas and red negatives, and `link` colours links. Where the same meaning was painted in two near tones (an error state's red-800 text beside an error callout's red-900), the family keeps one, so a status reads the same wherever it appears. The no-merge rule above applies to neutral tones, which carry layout rather than meaning.
- Corners follow the same rule: one `--radius` on `:root` (0.5rem, mode-independent) and `@theme inline` steps derived from it (`--radius-sm` = `--radius` − 4px, `md` − 2px, `lg` = `--radius`, `xl` + 4px, the shadcn/ui derivation), so changing `--radius` reshapes every corner. Components use `rounded-sm|md|lg|xl` and `rounded-full` for a pill, never bare `rounded`: Tailwind 4 compiles bare `rounded` to a literal `0.25rem` from its own default theme, which ignores `--radius`. Because `@theme inline` writes each step into its utility, Tailwind defines a step as a custom property at runtime only when a scanned source file references it (https://tailwindcss.com/docs/theme#generating-all-css-variables); read a corner with `getComputedStyle`. The one reference is the ECharts tooltip, which the engine rounds with a literal 4px: the chart theme's tooltip `extraCssText` sets `border-radius: var(--radius-sm)`, which follows the engine's own inline radius and so wins (`src/web/src/features/widgets/charts/theme.ts`).
- A page with `cards: true` paints `--card-mode-background` behind its cards: `#fafafa` (neutral-50) in light, where `--card` and `--background` are both white and a card would otherwise show only by its border, and `#0a0a0a` in dark, where `--card` is already lighter than the page. neutral-50 rather than neutral-100 keeps `--muted-foreground-faded` text on it at 4.54:1 (WCAG 1.4.3; `#f5f5f5` gives 4.35). `--card-border` stays under 3:1 against both surfaces, as it does on every existing card; a card groups content and is not a user-interface component, so WCAG 2.2 SC 1.4.11 (https://www.w3.org/TR/WCAG22/#non-text-contrast) does not apply to its edge.
- Syntax colours follow the same rule: fences highlight through shiki's css-variables theme (`createCssVariablesTheme` in `src/web/src/features/pages/shiki-highlighter.ts`), so every token is painted as `var(--shiki-token-*)` and the fence as `var(--shiki-background)`, and `styles.css` defines those per mode beside the other tokens — no `!important` override of shiki's inline colours. The fence surface is `--muted` in both modes, and each token value is a GitHub Primer syntax hue chosen to read at 4.5:1 (WCAG 1.4.3) on it; shiki's bundled github-light theme does not (its comment `#6a737d` is 4.42:1 and keyword `#d73a49` 4.20:1 on `#f5f5f5`).
