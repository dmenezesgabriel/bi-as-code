# ADR-0016 — The series palette is chosen for colour-vision deficiency, per mode, against measured floors

Status: accepted
Date: 2026-10-16

## Context

Every multi-series chart colours its series from `--chart-1` … `--chart-8` in `src/web/src/styles.css`, read by `readChartTokens` in `src/web/src/features/widgets/charts/theme.ts` (`SERIES_TOKEN_COUNT = 8`; ECharts cycles the list beyond that). Theme tokens are per mode and authored in hex ([ADR-0014](0014-theme-tokens-are-css-custom-properties-in-hex.md)).

The previous palette was Tailwind's 600 shades (`#2563eb` blue, … `#7c3aed` violet, `#059669` emerald, `#0891b2` cyan), identical in light and dark. Simulated for deuteranopia, series 1 (blue) and series 5 (violet) are ΔE 1.7 apart — the same colour — so any chart with 5 series lost a series for deutan readers. For tritan readers, emerald and cyan were 7.8 apart at 8 series. Normal vision saw 34.3.

The BI-as-code tools we compared all ship a default categorical palette and none picks it for colour-vision deficiency; their palettes measure 3.0–9.4 for deutans at 8 series. The published colour-blind-safe set is Okabe & Ito's (<https://jfly.uni-koeln.de/color/>; hexes as in R's `grDevices::palette.colors`, <https://raw.githubusercontent.com/wch/r-source/trunk/src/library/grDevices/R/colorstuff.R>): first 8 with black, protan 20.7 / deutan 17.0 / tritan 16.1. But its orange `#e69f00`, sky blue `#56b4e9` and yellow `#f0e442` measure 2.25, 2.31 and 1.32 against white, below WCAG 2.2 SC 1.4.11's 3:1 for graphical objects (<https://www.w3.org/TR/WCAG22/>). On the dark background `#0a0a0a` every Okabe–Ito hue except black clears 3:1. The conflict is a light-mode problem.

### Method

Implemented in `test/lib/palette-separability.ts`:

- Simulation: Machado, Oliveira & Fernandes 2009, severity 1.0, Table 1 of <https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html> (IEEE TVCG 15(6)), applied in linear sRGB and clamped to [0, 1].
- Separation: CIE76 ΔE in CIELAB (D65); a palette's figure is the minimum over every pair of its first _n_ colours.
- Contrast: WCAG relative-luminance contrast ratio.

## Decision drivers

- A reader with protan, deutan or tritan vision tells every series apart by colour alone, in both modes.
- Every series colour stands out from the page and from the value label drawn inside a stacked band (WCAG 2.2 SC 1.4.11).
- A later token edit cannot silently break either.

## Options considered

| Option                                                                                                | Pro                                                         | Con                                                                                         |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Keep the Tailwind 600s                                                                                | All 8 clear 3:1 in both modes                               | Deutan 1.7 at 5 series, tritan 7.8 at 8                                                     |
| Stock Okabe–Ito, one list for both modes                                                              | The published standard; 20.7 / 17.0 / 16.1                  | 3 colours under 3:1 on white; black under 3:1 on dark                                       |
| Okabe–Ito with its light hues darkened to 3:1 on white                                                | One familiar list, contrast met                             | Darkened orange and yellow converge for protans: 2.7 at 8 series                            |
| A light set with one hue per slot matching dark's order (`#0072b2 #776600 #005522 #990088 #0099ee …`) | Same hue order in both modes; 18.1 / 18.4 / 18.3 / 17.1     | Two olives on one chart                                                                     |
| The unconstrained maximin optimum                                                                     | Highest floor (29.4 in light)                               | Picks near-blacks (`#330044`, `#550011`) that read as text, not series                      |
| **Per-mode sets, Okabe–Ito-led, filled by search under fixed floors**                                 | Every floor met in both modes; Okabe–Ito wherever it passes | Series 2 differs between modes (vermillion in light, orange in dark); 8 more tokens to keep |

## Decision

**Floors**, per mode, held by `test/lib/series-palette.unit.test.ts` over the tokens it parses from `src/web/src/styles.css`:

- Every series colour is ≥ 3:1 against the mode's `--background` and against `--chart-label-inside`.
- The minimum pairwise ΔE of the 8 series is ≥ 16 under each of normal, protan, deutan and tritan vision — parity with Okabe–Ito, whose worst case is tritan 16.1.

**Palettes**:

| Mode  | `--chart-1..8`                                                                                  | n=8 normal / protan / deutan / tritan | n=5                       | Contrast on `--background`            |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------- | ------------------------------------- |
| light | `#0072b2 #d55e00 #009e73 #cc79a7 #8800ff #773311 #4433aa #bb55ff`                               | 31.9 / 22.7 / 17.9 / 17.0             | 53.6 / 22.7 / 17.9 / 17.0 | 3.06 (`#cc79a7`) – 9.27 on `#ffffff`  |
| dark  | `#0072b2 #e69f00 #009e73 #cc79a7 #56b4e9 #d55e00 #f0e442 #8800ff` (Okabe–Ito's 7 hues + violet) | 26.4 / 20.7 / 17.0 / 16.1             | 26.4 / 20.7 / 17.9 / 16.1 | 3.29 (`#8800ff`) – 14.97 on `#0a0a0a` |

How the sets were found: seed with the Okabe–Ito hues that clear 3:1 on the mode's background (light keeps blue, vermillion, bluish green and reddish purple), drop any seed within ΔE 16 of an earlier one, then fill to 8 greedily by maximin over an sRGB grid in steps of 17, restricted to C\* ≥ 40 and L\* in [30, 65] (light) or [40, 90] (dark), maximising the worst ΔE over the four visions.

- **Per mode, order may differ.** Each mode leads with the colours that clear its own background; the dark set is Okabe–Ito as published.
- **Dark `--chart-label-inside` is `#0a0a0a`**, not white: white on dark-mode orange, sky blue and yellow measures 2.25, 2.31 and 1.32. With the label equal to the background, the background floor also gives label contrast. Light keeps white.
- **`--chart-1` is Okabe–Ito blue `#0072b2` in both modes** (5.19:1 on white, 3.82:1 on `#0a0a0a`). It stays the end of the heatmap's default ramp (`[surface, tokens.series[0]]` in `src/web/src/features/widgets/charts/to-heatmap-option.ts`), so the ramp runs from the surface to a saturated blue in both modes.
- **8 colours.** More colours lower the floor; past 8, ECharts repeats the list.

## Consequences

- Editing a `--chart-*` token, `--background` or `--chart-label-inside` re-runs the floors in the unit suite; a pair that drops below ΔE 16 or a colour below 3:1 fails with the pair or colour named.
- A chart with a ninth series repeats `--chart-1`. A longer palette must re-derive the floor, since every added colour can only lower it.
- The same series index can be a different colour in light and dark (series 2, 5, 6, 7, 8). A reader who switches modes mid-read sees the legend change; the legend is the key in both.
- There is no author-set palette. Adding one is the extension point; an author palette is not held to these floors unless that change adds a check.
- Colour is still the only series encoding. Marker shapes or dash patterns would be a separate decision.
