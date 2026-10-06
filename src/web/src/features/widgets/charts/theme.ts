import { registerTheme } from "echarts/core";
import type { ThemeMode } from "../../chrome/theme";

/**
 * Registered echarts theme names keyed by the app's resolved mode. Charts
 * are canvas, so they can't see `.dark` CSS — the mode arrives through
 * `useThemeMode` and selects the theme at `init`.
 */
export function themeName(mode: ThemeMode): string {
  return `biac-${mode}`;
}

/**
 * Categorical palette shared by both themes — mid-tones that stay legible
 * on white and near-black. Order matters: series pick colors by index.
 * Exported for the heatmap's default `visualMap` ramp, which anchors on
 * `SERIES_COLORS[0]`.
 */
export const SERIES_COLORS = [
  "#2563eb", // blue-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#0891b2", // cyan-600
  "#db2777", // pink-600
  "#65a30d", // lime-600
] as const;

interface ModeTokens {
  readonly text: string;
  readonly textMuted: string;
  readonly axisLine: string;
  readonly splitLine: string;
  readonly tooltipBg: string;
  readonly tooltipBorder: string;
  /** The page surface behind the chart — the ramp's zero end. */
  readonly surface: string;
  /** The app's border tone (`border-neutral-200`/`dark:border-neutral-800`). */
  readonly border: string;
}

const TOKENS: Record<ThemeMode, ModeTokens> = {
  light: {
    text: "#171717", // neutral-900
    textMuted: "#525252", // neutral-600
    axisLine: "#a3a3a3", // neutral-400
    splitLine: "#e5e5e5", // neutral-200
    tooltipBg: "#ffffff",
    tooltipBorder: "#e5e5e5",
    surface: "#ffffff", // App.tsx `bg-white`
    border: "#e5e5e5", // neutral-200
  },
  dark: {
    text: "#f5f5f5", // neutral-100
    textMuted: "#a3a3a3", // neutral-400
    axisLine: "#525252", // neutral-600
    splitLine: "#262626", // neutral-800
    tooltipBg: "#171717", // neutral-900
    tooltipBorder: "#404040", // neutral-700
    surface: "#0a0a0a", // App.tsx `dark:bg-neutral-950`
    border: "#262626", // neutral-800
  },
};

/**
 * The per-mode color tokens an option builder needs when a color must be
 * baked into the option itself rather than inherited from the registered
 * theme — e.g. the heatmap's `visualMap.inRange` ramp, which anchors on the
 * surface so a "no data" tint matches the page behind the canvas.
 */
export function themeTokens(mode: ThemeMode): ModeTokens {
  return TOKENS[mode];
}

function buildTheme(t: ModeTokens): Record<string, unknown> {
  const axis = {
    axisLine: { lineStyle: { color: t.axisLine } },
    axisTick: { lineStyle: { color: t.axisLine } },
    axisLabel: { color: t.textMuted },
    splitLine: { lineStyle: { color: t.splitLine } },
    nameTextStyle: { color: t.textMuted },
  };
  return {
    color: [...SERIES_COLORS],
    textStyle: { color: t.text },
    title: {
      textStyle: { color: t.text },
      subtextStyle: { color: t.textMuted },
    },
    legend: { textStyle: { color: t.textMuted } },
    categoryAxis: axis,
    valueAxis: axis,
    timeAxis: axis,
    logAxis: axis,
    tooltip: {
      backgroundColor: t.tooltipBg,
      borderColor: t.tooltipBorder,
      textStyle: { color: t.text },
    },
  };
}

// Self-registers on module load — `themeName` consumers always find the
// themes registered, no init ordering to get wrong.
registerTheme(themeName("light"), buildTheme(TOKENS.light));
registerTheme(themeName("dark"), buildTheme(TOKENS.dark));
