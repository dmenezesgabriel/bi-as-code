import type { ChartTokens } from "./types";

const LIGHT_SERIES = [
  "#0072b2",
  "#d55e00",
  "#009e73",
  "#cc79a7",
  "#8800ff",
  "#773311",
  "#4433aa",
  "#bb55ff",
] as const;

const DARK_SERIES = [
  "#0072b2",
  "#e69f00",
  "#009e73",
  "#cc79a7",
  "#56b4e9",
  "#d55e00",
  "#f0e442",
  "#8800ff",
] as const;

/** The light chart tokens, as `src/web/src/styles.css` defines them. */
export const LIGHT_CHART_TOKENS: ChartTokens = {
  foreground: "#171717",
  mutedForeground: "#525252",
  axis: "#a1a1a1",
  border: "#e5e5e5",
  background: "#ffffff",
  popover: "#ffffff",
  popoverBorder: "#e5e5e5",
  labelInside: "#ffffff",
  series: LIGHT_SERIES,
};

/** The dark chart tokens, as `src/web/src/styles.css` defines them. */
export const DARK_CHART_TOKENS: ChartTokens = {
  foreground: "#f5f5f5",
  mutedForeground: "#a1a1a1",
  axis: "#525252",
  border: "#262626",
  background: "#0a0a0a",
  popover: "#171717",
  popoverBorder: "#404040",
  labelInside: "#0a0a0a",
  series: DARK_SERIES,
};
