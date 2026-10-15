import type { ChartTokens } from "./types";

const SERIES = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
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
  series: SERIES,
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
  labelInside: "#ffffff",
  series: SERIES,
};
