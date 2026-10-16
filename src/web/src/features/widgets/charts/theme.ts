import type { ChartTokens, ReadToken } from "./types";

/** The categorical palette's length — `--chart-1` through `--chart-8`. */
const SERIES_TOKEN_COUNT = 8;

/**
 * The chart's colours, read off the theme tokens in `src/web/src/styles.css`
 * through `read` — the canvas cannot inherit CSS, so every colour the engine
 * paints is looked up here, never copied into this module (ADR-0014).
 *
 * @example
 * const tokens = withTokenProbe("dark", readChartTokens);
 */
export function readChartTokens(read: ReadToken): ChartTokens {
  const token = (name: string): string => requireToken(read, name);
  return {
    foreground: token("--foreground"),
    mutedForeground: token("--muted-foreground"),
    axis: token("--chart-axis"),
    border: token("--border"),
    background: token("--background"),
    popover: token("--popover"),
    popoverBorder: token("--popover-border"),
    labelInside: token("--chart-label-inside"),
    series: Array.from({ length: SERIES_TOKEN_COUNT }, (_, i) =>
      token(`--chart-${i + 1}`),
    ),
  };
}

function requireToken(read: ReadToken, name: string): string {
  const value = read(name).trim();
  if (value !== "") return value;
  throw new Error(
    `chart theme token ${name} is undefined — expected a colour such as "#e5e5e5" declared on :root and .dark in styles.css`,
  );
}

/**
 * The echarts theme object for one mode's tokens: palette, text, axis and
 * tooltip colors, and the data-label color of the marks that label outside
 * themselves. `echarts.init` takes it directly, so a re-init after a mode
 * flip paints whatever the stylesheet holds at that moment.
 *
 * @example
 * echarts.init(el, chartTheme(withTokenProbe("dark", readChartTokens)));
 */
export function chartTheme(t: ChartTokens): Record<string, unknown> {
  const axis = {
    axisLine: { lineStyle: { color: t.axis } },
    axisTick: { lineStyle: { color: t.axis } },
    axisLabel: { color: t.mutedForeground },
    splitLine: { lineStyle: { color: t.border } },
    nameTextStyle: { color: t.mutedForeground },
  };
  // A label with no color of its own gets the engine's fallback: a dark
  // glyph inside a white outline, whatever the mode — unreadable on the dark
  // surface. An explicit fill also drops that outline. Heatmap is left out:
  // its labels sit on the ramp's cells, not on the page.
  const outsideLabel = { label: { color: t.mutedForeground } };
  return {
    color: [...t.series],
    textStyle: { color: t.foreground },
    title: {
      textStyle: { color: t.foreground },
      subtextStyle: { color: t.mutedForeground },
    },
    legend: { textStyle: { color: t.mutedForeground } },
    categoryAxis: axis,
    valueAxis: axis,
    timeAxis: axis,
    logAxis: axis,
    bar: outsideLabel,
    line: outsideLabel,
    scatter: outsideLabel,
    tooltip: {
      // The engine leaves html tooltips unconfined (its documented
      // backward-compat default) and flips one that would cross the right
      // edge left by its own width with no lower bound — on a phone-width
      // chart that lands outside the chart's left edge.
      confine: true,
      backgroundColor: t.popover,
      borderColor: t.popoverBorder,
      textStyle: { color: t.foreground },
      // The engine rounds its html tooltip with a literal 4px; its
      // extraCssText lands after that in the element's inline style, so the
      // corner follows the page's radius scale instead (ADR-0014). Tailwind
      // emits `--radius-sm` at runtime only because this file references it
      // (https://tailwindcss.com/docs/theme#generating-all-css-variables).
      extraCssText: "border-radius: var(--radius-sm);",
    },
  };
}
