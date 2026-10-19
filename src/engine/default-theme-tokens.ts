import type { BrandColours, ColourMode } from "./types.js";

/** The theme tokens a brand colour is contrast-checked against. */
export type ThemeTokenName =
  | "--primary"
  | "--primary-foreground"
  | "--secondary"
  | "--background"
  | "--foreground"
  | "--muted-foreground"
  | "--ring"
  | "--card"
  | "--card-mode-background"
  | "--positive"
  | "--negative"
  | "--chart-label-inside"
  | SeriesTokenName;

/** A series colour token, `--chart-1`…`--chart-8`. */
export type SeriesTokenName = `--chart-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

/**
 * The series tokens in palette order: a brand palette lays its colours over
 * them by position, so their count is the palette's ceiling (ADR-0016).
 *
 * @example
 * SERIES_TOKENS[0]; // → "--chart-1"
 */
export const SERIES_TOKENS: readonly SeriesTokenName[] = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
];

/**
 * The heatmap ramp token: one comma-separated list of colours, the way
 * Tailwind's `--tw-gradient-stops` carries a gradient, since a ramp has no
 * fixed length to number tokens by.
 *
 * @example
 * `${SCALE_TOKEN}: #1e40af, #60a5fa;`; // → "--chart-scale: #1e40af, #60a5fa;"
 */
export const SCALE_TOKEN = "--chart-scale";

/** The value of each checked token, per mode. */
export type ThemeTokens = Readonly<
  Record<ColourMode, Readonly<Record<ThemeTokenName, string>>>
>;

/**
 * The default value of each checked token, per mode. These mirror
 * `src/web/src/styles.css`, which the engine cannot import — a unit test
 * fails when the two drift apart.
 *
 * @example
 * DEFAULT_THEME_TOKENS.dark["--background"]; // → "#0a0a0a"
 */
export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  light: {
    "--primary": "#171717",
    "--primary-foreground": "#ffffff",
    "--secondary": "#e5e5e5",
    "--background": "#ffffff",
    "--foreground": "#171717",
    "--muted-foreground": "#525252",
    "--ring": "#737373",
    "--card": "#ffffff",
    "--card-mode-background": "#fafafa",
    "--positive": "#00784f",
    "--negative": "#c10007",
    "--chart-label-inside": "#ffffff",
    "--chart-1": "#0072b2",
    "--chart-2": "#d55e00",
    "--chart-3": "#009e73",
    "--chart-4": "#cc79a7",
    "--chart-5": "#8800ff",
    "--chart-6": "#773311",
    "--chart-7": "#4433aa",
    "--chart-8": "#bb55ff",
  },
  dark: {
    "--primary": "#e5e5e5",
    "--primary-foreground": "#171717",
    "--secondary": "#404040",
    "--background": "#0a0a0a",
    "--foreground": "#f5f5f5",
    "--muted-foreground": "#a1a1a1",
    "--ring": "#a1a1a1",
    "--card": "#171717",
    "--card-mode-background": "#0a0a0a",
    "--positive": "#00d492",
    "--negative": "#ff6467",
    "--chart-label-inside": "#0a0a0a",
    "--chart-1": "#0072b2",
    "--chart-2": "#e69f00",
    "--chart-3": "#009e73",
    "--chart-4": "#cc79a7",
    "--chart-5": "#56b4e9",
    "--chart-6": "#d55e00",
    "--chart-7": "#f0e442",
    "--chart-8": "#8800ff",
  },
};

/**
 * The theme token each `brand.colors` key replaces.
 *
 * @example
 * BRAND_TOKENS.primary; // → "--primary"
 */
export const BRAND_TOKENS: Readonly<
  Record<keyof BrandColours, ThemeTokenName>
> = {
  primary: "--primary",
  background: "--background",
  positive: "--positive",
  negative: "--negative",
};
