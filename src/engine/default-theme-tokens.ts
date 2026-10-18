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
  | `--chart-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

/**
 * The default value of each checked token, per mode. These mirror
 * `src/web/src/styles.css`, which the engine cannot import — a unit test
 * fails when the two drift apart.
 *
 * @example
 * DEFAULT_THEME_TOKENS.dark["--background"]; // → "#0a0a0a"
 */
export const DEFAULT_THEME_TOKENS: Readonly<
  Record<ColourMode, Readonly<Record<ThemeTokenName, string>>>
> = {
  light: {
    "--primary": "#171717",
    "--primary-foreground": "#ffffff",
    "--secondary": "#e5e5e5",
    "--background": "#ffffff",
    "--foreground": "#171717",
    "--muted-foreground": "#525252",
    "--ring": "#737373",
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
};
