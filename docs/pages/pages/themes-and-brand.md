---
title: Themes and brand
icon: settings
sidebar_position: 104
keywords:
  [
    theme,
    dark mode,
    light mode,
    color scheme,
    toggle,
    brand,
    colors,
    palette,
    fonts,
    front-matter,
    contrast,
  ]
---

# Themes and brand

A site has two themes, light and dark, and a reader picks between them. The brand is the set of colours, fonts and corner radius that both themes are drawn in. A project sets its brand once in `biac.config.ts`, and a single page can set its own in front-matter. This page describes how the mode is chosen, what the brand is made of, and how a page overrides it. The `theme` and `brand` keys of the project are on [biac.config.ts](/pages/biac-config).

## Light and dark

The mode a page opens in comes from the first of these that has an answer:

1. The reader's own choice, made with the toggle in the header.
2. The project's `theme` in `biac.config.ts`, when it is `light` or `dark`.
3. The reader's operating system, through `prefers-color-scheme`, when `theme` is `system`, which is the default.

The toggle is the sun or moon button at the right of the header. Its icon shows the mode a click switches to, and its accessible name reads `Switch to dark mode` or `Switch to light mode`.

A choice made with the toggle is stored in the browser's `localStorage` under the key `biac.theme`, as `light` or `dark`. It belongs to the browser, not to the tab, so it survives a reload and a restart and applies to every page of the site. Any other stored value is ignored. A browser that refuses storage, such as a private window, still switches for the session and forgets the choice afterwards.

While the reader has made no choice and `theme` is `system`, the page follows the operating system live: switching the system to dark switches the open page too. A stored choice stops that.

The mode is applied before the first paint, so a page never flashes in the wrong mode. Dark mode adds a `dark` class to the root element and sets the browser's `color-scheme`, so scrollbars and native form controls match.

## What a theme is made of

Every colour on the site is a named value with one setting for light and one for dark: the page background and its text, the filled colour of controls and selections, the field and sidebar surfaces, the positive and negative colours of a delta, and the series colours of charts. Switching the mode swaps all of them together, and charts redraw in the new colours.

The brand replaces some of those values, and all of them can be replaced. Its six keys are the same in `biac.config.ts` and in a page's front-matter:

| Key        | What it sets                                                           |
| ---------- | ---------------------------------------------------------------------- |
| `colors`   | the primary, background, positive, negative, field and sidebar colours |
| `palette`  | the chart series colours                                               |
| `scale`    | the heatmap ramp                                                       |
| `fonts`    | the body, heading and code fonts, each a system stack                  |
| `fontSize` | the root font size                                                     |
| `radius`   | the corner radius of controls and cards                                |

Their values, ranges and the colour format are on [biac.config.ts](/pages/biac-config). A key a brand leaves out keeps biac's default.

## A page's own brand

A page sets `brand` in its front-matter with the keys above and the same rules. [A branded page](/pages/branded-page-example) is this site's live example of the YAML below.

```yaml
---
title: A branded page
brand:
  colors:
    primary: { light: "#7c3aed", dark: "#c4b5fd" }
  palette: { light: ["#7c3aed"], dark: ["#c4b5fd"] }
  fonts: { heading: "serif" }
  radius: "1rem"
---
```

The page's brand is laid over the project's, and only the keys the page sets change. A page that sets `colors.primary` keeps the project's background, palette and fonts. A `palette` or `scale` can name one mode alone: `palette: { light: ["#7c3aed"] }` leaves dark mode's palette as it was. A colour in `colors` takes both modes, as it does in `biac.config.ts`.

It restyles the whole document while the page is open, the sidebar and header included, wherever a changed value is used. The reader's light or dark choice still applies, and each mode takes its own value from the page. Leave the page and the project's brand returns; the next page starts from the project's brand again, not from this one.

Charts take the page's brand too. They read the same values, and the page renders only after its brand is in place, so a chart never draws once in the previous page's colours.

## Checks

A page's colours are measured when the page is compiled, with the same floors as the project's: 4.5:1 for text, such as a delta, and 3:1 for control shapes, the focus ring and every chart series. A page's colours are measured against the project's brand, because those are the values they land on. A failure shows its message in place of the page in the dev server, fails `biac build`, and names the page file, the key, the neighbour it fails against, the measured ratio and the key to change.

```text
Invalid front-matter in pages/sales.md — brand.colors.background.light: #fdf6e3 against --chart-4 #cc79a7 measures 2.83:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light
```

A key of the wrong shape fails the page the same way:

```text
Invalid front-matter in pages/sales.md — brand.colors.primary.light: expected a "#rrggbb" colour, got "red"
```

```text
Invalid front-matter in pages/sales.md — brand.fonts.body: expected one of "sans-serif", "serif", "mono", got "Inter"
```

```text
Invalid front-matter in pages/sales.md — brand.fontSize: expected a "<n>px" size, n a whole number from 12 to 24, got "30px"
```

A misspelt key is refused with a suggestion:

```text
Invalid front-matter in pages/sales.md — brand.colour: unknown key, expected one of colors, palette, scale, fonts, fontSize, radius (did you mean colors?)
```
