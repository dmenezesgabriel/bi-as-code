# ADR-0019 — The brand is contrast-checked config for colour, type and shape

Status: accepted
Date: 2026-10-19
Supersedes: [ADR-0018](0018-brand-colours-are-contrast-checked-config-not-a-theme.md)

## Context

ADR-0018 made brand colours a `brand` key in `biac.config.ts` and in a page's front-matter: `colors.primary`, `colors.background`, `palette` and `scale`, each measured against its WCAG 2.2 floor when it is loaded. It left fonts, radius and the other tokens for later. The SPA already had tokens for them in `src/web/src/styles.css`, but nothing could set them: `--radius`, `--positive`/`--negative` (the delta tones in `src/web/src/features/widgets/value/delta-display.tsx`), `--field` (the input surface) and `--sidebar`. There was no font-family token. Text took Tailwind's `--font-sans`, and charts used ECharts' own default font (`sans-serif`, or `Microsoft YaHei` on Windows) because `src/web/src/features/widgets/charts/theme.ts` set none.

These forces carry over from ADR-0018: an existing config keeps working, a colour that breaks a floor fails where it is written, and the public surface stays small. Type and shape add two more:

- A font file is a request on every page, and a third-party font host is a request to someone else's server. A static build should make neither by default.
- A root font size that replaces the reader's browser default breaks text resizing for readers who set a larger one (WCAG 2.2 SC 1.4.4, <https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html>).

## Decision drivers

- No accessibility regression the author cannot see, for every colour key (as in ADR-0018).
- A bad value fails at its location. A silent fallback would ship a look the author never saw.
- The fonts load no font file and make no network request.
- The reading measure (`--container-measure`, 40rem = 70ch) holds at any font size.
- Existing configs keep working unchanged.

## Options considered

| Concern       | Option                           | Pro                                                 | Con                                                                           |
| ------------- | -------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Font size     | Scale only the `--text-*` steps  | The root stays the reader's                         | Spacing and `--container-measure` stay fixed, so the measure drifts from 70ch |
| Font size     | Set the root font size           | Text, spacing, measure and rem radii scale together | In px it overrides the reader's default size                                  |
| Font choice   | Any font family                  | Any brand font                                      | Invites a font file or a third-party request                                  |
| Font choice   | One of three named system stacks | No request; the defaults render as before           | No exact brand typeface                                                       |
| Invalid value | Fall back to the default         | Never blocks a build                                | The look is not what the author wrote                                         |
| Invalid value | A located error                  | The author fixes it where it was typed              | A typo stops `biac build`                                                     |

## Decision

The brand is `brand: { colors: { primary, background, positive, negative, field, sidebar }, palette, scale, fonts: { body, heading, code }, fontSize, radius }` in `biac.config.ts` and in a page's front-matter. One validator reads both (`src/engine/brand-config.ts` `readBrand`). A bad shape, an unknown stack, a size or radius out of range, or a colour under its contrast floor is a located error that fails `biac dev`'s compile and `biac build`. No value is adjusted for the author.

- **Colours.** Every colour is `{ light, dark }` in `#RRGGBB` (hex only, ADR-0014). `primary` → `--primary`, `background` → `--background`, `positive` → `--positive`, `negative` → `--negative`, `field` → `--field`, `sidebar` → `--sidebar`. `palette` overlays `--chart-1`…`--chart-8` by position, at most 8 entries ([ADR-0016](0016-the-series-palette-is-chosen-for-colour-vision-deficiency.md)). `scale` is the heatmap ramp `--chart-scale`: one colour ramps from `--background`, and two or more are the ramp as written. Each mode is optional and independent. Colours are written per mode on `:root, .light` and `.dark` (`src/engine/brand-css.ts`).
- **Contrast floors.** `src/engine/brand-contrast.ts` `CONTRAST_PAIRS` lists every pair. A pair is checked in both modes whenever either side is a brand colour (WCAG 2.2, <https://www.w3.org/TR/WCAG22/>):
  - `--primary` against `--primary-foreground` at 4.5:1 (SC 1.4.3), and against `--background` and `--secondary` at 3:1 (SC 1.4.11).
  - `--background` against `--foreground` and `--muted-foreground` at 4.5:1 (SC 1.4.3), and against `--ring` at 3:1 (SC 2.4.13).
  - Every series against `--background` and `--chart-label-inside` at 3:1 (SC 1.4.11).
  - `--positive` and `--negative` against `--background`, `--card` and `--card-mode-background` at 4.5:1. They are also checked against their own 10% chip over each of those surfaces (`blendOver` in `src/engine/contrast-ratio.ts`). The default light `--positive` is `#00784f` because the previous `#007a55` measured 4.47:1 on its chip over `--card-mode-background`.
  - `--field` against `--foreground` and `--muted-foreground-faded` (the value and the placeholder) at 4.5:1.
  - `--sidebar` against `--foreground`, `--sidebar-foreground` and `--muted-foreground` at 4.5:1, and against `--ring` at 3:1, because the sidebar links draw their focus ring inside it.
  - The error names the key path, the colour, the token it was measured against, the ratio and the floor, at `file:line:column`.
- **What is not checked.** Scale colours are not checked, because a heatmap cell's value is in its label and tooltip. The ΔE ≥ 16 colour-vision separation of ADR-0016 holds for the default palette only. `--field` is not checked against its `--input` border, and the toggle thumb is not checked against its `--secondary` track (SC 1.4.11), because the defaults already miss both (1.48:1 and 1.26:1 in light) and the label and placeholder name the control. The active sidebar link's `--sidebar-accent` chip is not checked either: it cannot fail while the plain sidebar pairs pass, as long as `--sidebar-accent`, `--foreground` and `--ring` are not brand colours.
- **Fonts.** `body`, `heading` and `code` each take `"sans-serif"`, `"serif"` or `"mono"`. These are Tailwind's system stacks, which `src/web/src/styles.css` names `--font-stack-sans-serif`/`-serif`/`-mono`. The brand writes `--body-font`, `--heading-font` and `--code-font` as `var(--font-stack-<name>)` and never writes a font list itself. No font file loads. The defaults (body and heading sans-serif, code mono) render as before. Charts read `--body-font` into ECharts' `textStyle.fontFamily` (`readChartTokens` in `src/web/src/features/widgets/charts/theme.ts`), so chart text follows the body font.
- **Font size.** `fontSize` is `"<n>px"`, with `n` a whole number from 12 to 24 inclusive. Below 12px body text stops being readable. Above 24px, a 1440px screen holds little more than a heading. It sets the root font size, written as a percentage of the browser's 16px default (WCAG technique C12, <https://www.w3.org/WAI/WCAG22/Techniques/css/C12>), so a reader's larger default still scales it. Every rem then scales with it, including the 40rem reading measure.
- **Radius.** `radius` is `"0"`, or `"<n>px"` / `"<n>rem"` with `n` a non-negative decimal up to 24px / 1.5rem. It sets `--radius` as written, and the `rounded-sm`…`rounded-xl` steps derive from it in `src/web/src/styles.css`. A rem radius scales with `fontSize` and a px radius does not. At `"0"`, the browser clamps `--radius-sm` (`calc(var(--radius) - 4px)`) to zero.
- **Where the CSS goes.** Fonts, size and radius are the same in both modes. They go in one `:root` rule ahead of the per-mode colour rules (`src/engine/brand-css.ts` `brandCss`). The project brand is a `<style>` that `src/engine/pages-plugin.ts` `transformIndexHtml` writes into the HTML, so it is in place before first paint.
- **A page overrides key by key.** A page's front-matter `brand:` takes every key above. It is compiled into the page module as `brandCss` and holds only the keys the page sets. `src/web/src/features/pages/page-brand-style.tsx` `PageBrandStyle` mounts it as a document-level `<style>` after the project's, so the cascade merges the two key by key. A page that sets `fonts.body` alone keeps the project's heading and code fonts, size and radius. The style leaves with the page. A page's `fontSize` changes the root while the page is mounted, as its `background` changes the whole document. A page's colours are measured against the project brand they land on (`brandedThemeTokens`), and a page error names the page file (`src/engine/page-brand-frontmatter.ts`).

## Consequences

- An author learns about an inaccessible colour or an out-of-range value where they typed it, not from a user. The cost is that some brand colours are refused, notably most non-white light backgrounds with the default palette: `#fdf6e3` measures 2.83:1 against `--chart-4 #cc79a7`, because the light palette was tuned for white.
- The unenforced ΔE check will look like an inconsistency. Enforcing it would mean refusing almost every partial palette, so it stays a documented property of the defaults.
- A brand cannot name an exact typeface. Adding one would mean loading a font, which this decision rules out.
- Chart canvases and their axis labels are sized in px, so `fontSize` does not scale them.
- A page override replaces `scale` rather than overlaying it, because a one-stop scale means "ramp from `--background`", and overlaying stops would change that meaning.
- A page's front-matter colour still needs both modes, as in `biac.config.ts`, because both run the same validator.
- On a cold load straight onto a page with its own brand, the chrome paints in the project brand while the lazy page module loads, and the page body waits for its style. Removing this needs per-page HTML, which the SPA build does not have ([ADR-0008](0008-static-build-is-a-spa-folder.md)).
- Text, border and muted colours are not derived from `background`. They stay the defaults, and the floors above reject a background they no longer suit.
- Raising `--input` so a field's border meets 3:1 on `--field` is a separate change to the defaults.
