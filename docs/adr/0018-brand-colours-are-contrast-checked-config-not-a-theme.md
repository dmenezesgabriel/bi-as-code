# ADR-0018 — Brand colours are a contrast-checked `brand` key, not a theme

Status: accepted
Date: 2026-10-19

## Context

Every colour the SPA paints is a CSS custom property in `src/web/src/styles.css`, authored in hex per mode on `:root, .light` and `.dark` ([ADR-0014](0014-theme-tokens-are-css-custom-properties-in-hex.md)). Chrome and input widgets read them through Tailwind utilities (`bg-primary` in `src/web/src/features/widgets/inputs/slider.tsx`), and charts read them with `getComputedStyle` (`readChartTokens` in `src/web/src/features/widgets/charts/theme.ts`). A project that wanted its own primary, background, series palette or heatmap ramp had to edit the SPA.

Three forces shaped the config surface:

- `theme` already exists in `biac.config.ts` and means the colour mode (`src/engine/types.ts` `BiacTheme`: `"light" | "dark" | "system"`). Reusing it for colours would break every existing config.
- The default tokens are tuned against measured floors: text at 4.5:1 (WCAG 2.2 SC 1.4.3), graphical objects and focus rings at 3:1 (SC 1.4.11, SC 2.4.13; <https://www.w3.org/TR/WCAG22/>), and a series palette that keeps ΔE ≥ 16 under simulated colour-vision deficiency ([ADR-0016](0016-the-series-palette-is-chosen-for-colour-vision-deficiency.md)). A user colour can silently break any of them; the BI-as-code tools we compared either derive neighbouring colours without measuring them or take user colours as given.
- zrender, ECharts' renderer, parses hex but not `oklch()` (ADR-0014).

## Decision drivers

- No accessibility regression a project author cannot see: a colour that breaks a floor must say so before anyone ships it.
- Existing configs keep working unchanged.
- A small public surface: each settable colour is a token we promise to keep.
- No frame painted in the wrong colours (ADR-0014's first-paint rule), for the project brand and, as far as a client-rendered page allows, for a page's.

## Options considered

| Option                                            | Pro                                                        | Con                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Overload `theme` with colours                     | One key                                                    | Breaks every config that sets `theme: "dark"`                                |
| Named preset themes                               | Curated, always accessible                                 | Cannot express a real brand; every preset is a palette we must tune and test |
| Expose every token                                | Total control                                              | ~180 internal names become public API                                        |
| A `brand` key with a few tokens, measured at load | Small surface; floors enforced where the colour is written | Some brands are rejected and must be adjusted by hand                        |

## Decision

Brand colours are a `brand: { colors: { primary, background }, palette, scale }` key in `biac.config.ts` and in a page's front-matter, every value `{ light, dark }` in `#RRGGBB`, and a colour below its contrast floor is a located error that fails `biac dev`'s compile and `biac build`.

- **What can be set.** `colors.primary` → `--primary`, `colors.background` → `--background`; `palette` overlays `--chart-1`…`--chart-8` by position, at most 8 entries (ECharts repeats the list past 8, ADR-0016), so a one-colour palette changes series 1 only; `scale` is the heatmap ramp `--chart-scale`, where one colour ramps from `--background` and two or more are the ramp as written. Each mode is optional and independent (`src/engine/brand-config.ts`, `src/engine/brand-css.ts`).
- **Which floors are enforced.** `src/engine/brand-contrast.ts` `CONTRAST_PAIRS`, checked whenever either side is a brand colour, in both modes: `--primary` against `--primary-foreground` 4.5:1 (1.4.3), against `--background` and `--secondary` 3:1 (1.4.11); `--background` against `--foreground` and `--muted-foreground` 4.5:1 (1.4.3) and against `--ring` 3:1 (2.4.13); every series against `--background` and `--chart-label-inside` 3:1 (1.4.11). The error names the key path, the colour, the token it was measured against, the ratio and the floor, at `file:line:column`; the colour is never adjusted for the author. Scale colours are unchecked: a heatmap cell's value is in its label and tooltip.
- **What is not enforced.** The ΔE ≥ 16 colour-vision separation of ADR-0016 holds for the default palette only. A brand palette is the author's choice: a one-colour overlay of `#1e40af` over the light defaults measures ΔE 2.8 under protan and deutan simulation against `--chart-7 #4433aa` (`test/lib/palette-separability.ts` `minimumSeparation`), and enforcing the floor would reject the most common brand edit — recolouring series 1.
- **Where the CSS goes.** The project brand is a `<style>` that `src/engine/pages-plugin.ts` `transformIndexHtml` writes into the HTML, so it is in place before first paint. A page's brand is compiled into the page module as `brandCss`, holding only the keys the page sets, and `src/web/src/features/pages/page-brand-style.tsx` `PageBrandStyle` mounts it as a document-level `<style>` after the project's: the cascade is a key-by-key merge, and the style leaves with the page. A page's colours are measured against the project brand they land on (`brandedThemeTokens`).

## Consequences

- An author learns about an inaccessible colour where they typed it, not from a user. The cost is that some brand colours are refused, notably most non-white light backgrounds with the default palette: `#fdf6e3` measures 2.83:1 against `--chart-4 #cc79a7`, because the light palette was tuned for white and has little headroom.
- The palette floor that will look like an inconsistency is the unenforced ΔE check. Enforcing it means refusing almost every partial palette; it stays a documented property of the defaults.
- `scale` replaces rather than overlays in a page override, because a one-stop scale means "ramp from `--background`", and overlaying stops would change that meaning.
- A page's front-matter colour still needs both modes, as in `biac.config.ts`, because both run the same validator.
- On a cold load straight onto a page with its own brand, the chrome paints in the project brand while the lazy page module loads; the page body waits for its style. Removing this needs per-page HTML, which the SPA build does not have ([ADR-0008](0008-static-build-is-a-spa-folder.md)).
- Text, border and muted colours are not derived from `background`; they stay the defaults, and the floors above reject a background they no longer suit. Fonts, radius and further tokens are a separate surface.
