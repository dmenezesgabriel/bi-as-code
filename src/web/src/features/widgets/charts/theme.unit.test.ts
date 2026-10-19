import { describe, expect, it } from "vitest";
import { DARK_CHART_TOKENS, LIGHT_CHART_TOKENS } from "./chart-tokens.fixture";
import { chartTheme, readChartTokens } from "./theme";
import type { ChartTokens } from "./types";

interface LabelTheme {
  readonly label?: {
    readonly color?: string;
    readonly textBorderWidth?: number;
  };
}

interface AxisTheme {
  readonly axisLine: { readonly lineStyle: { readonly color: string } };
  readonly axisTick: { readonly lineStyle: { readonly color: string } };
  readonly axisLabel: { readonly color: string };
  readonly splitLine: { readonly lineStyle: { readonly color: string } };
}

interface TooltipTheme {
  readonly confine?: boolean;
  readonly backgroundColor?: string;
  readonly borderColor?: string;
  readonly textStyle?: { readonly color?: string };
  readonly extraCssText?: string;
}

/** A stylesheet stand-in: answers custom-property lookups from a map. */
class FakeTokenSheet {
  constructor(private readonly values: Readonly<Record<string, string>>) {}

  read = (name: string): string => this.values[name] ?? "";
}

const LIGHT_SHEET: Record<string, string> = {
  "--foreground": "#171717",
  "--muted-foreground": "#525252",
  "--chart-axis": "#a1a1a1",
  "--border": "#e5e5e5",
  "--background": "#ffffff",
  "--popover": "#ffffff",
  "--popover-border": "#e5e5e5",
  "--chart-label-inside": "#ffffff",
  ...Object.fromEntries(
    LIGHT_CHART_TOKENS.series.map((color, i) => [`--chart-${i + 1}`, color]),
  ),
  "--chart-scale": "#0072b2",
  "--body-font": LIGHT_CHART_TOKENS.fontFamily,
};

const TOKEN_SETS: readonly [string, ChartTokens][] = [
  ["light", LIGHT_CHART_TOKENS],
  ["dark", DARK_CHART_TOKENS],
];
const OUTSIDE_LABEL_TYPES = ["bar", "line", "scatter"] as const;

describe("readChartTokens", () => {
  it("maps each custom property onto its chart role", () => {
    const sheet = new FakeTokenSheet(LIGHT_SHEET);

    const tokens = readChartTokens(sheet.read);

    expect(tokens).toEqual(LIGHT_CHART_TOKENS);
  });

  it("names the token a stylesheet leaves undefined", () => {
    const sheet = new FakeTokenSheet({ ...LIGHT_SHEET, "--chart-axis": "" });

    const read = () => readChartTokens(sheet.read);

    expect(read).toThrow(/--chart-axis/);
  });

  it("trims the whitespace a computed custom property keeps", () => {
    const padded = Object.fromEntries(
      Object.entries(LIGHT_SHEET).map(([name, value]) => [name, ` ${value}`]),
    );
    const sheet = new FakeTokenSheet(padded);

    const tokens = readChartTokens(sheet.read);

    expect(tokens.border).toBe("#e5e5e5");
  });

  it("splits the scale token's comma-separated list into trimmed stops", () => {
    const sheet = new FakeTokenSheet({
      ...LIGHT_SHEET,
      "--chart-scale": " #fef3c7,#1e40af ,  #172554",
    });

    const tokens = readChartTokens(sheet.read);

    expect(tokens.scale).toEqual(["#fef3c7", "#1e40af", "#172554"]);
  });

  it("names the body font token when a stylesheet leaves it undefined", () => {
    const sheet = new FakeTokenSheet({ ...LIGHT_SHEET, "--body-font": "" });

    const read = () => readChartTokens(sheet.read);

    expect(read).toThrow(/--body-font .*a font stack/);
  });

  it("names the scale token when a stylesheet leaves it undefined", () => {
    const sheet = new FakeTokenSheet({ ...LIGHT_SHEET, "--chart-scale": "" });

    const read = () => readChartTokens(sheet.read);

    expect(read).toThrow(/--chart-scale/);
  });
});

describe("chartTheme axes", () => {
  it.each(TOKEN_SETS)("paints %s axes from the tokens", (_mode, tokens) => {
    const theme = chartTheme(tokens) as Record<string, AxisTheme>;

    const axis = theme.valueAxis;

    expect(axis).toMatchObject({
      axisLine: { lineStyle: { color: tokens.axis } },
      axisTick: { lineStyle: { color: tokens.axis } },
      axisLabel: { color: tokens.mutedForeground },
      splitLine: { lineStyle: { color: tokens.border } },
    });
  });

  it.each(TOKEN_SETS)("colours %s series from the palette", (_m, tokens) => {
    const theme = chartTheme(tokens);

    const palette = theme.color;

    expect(palette).toEqual([...tokens.series]);
  });
});

describe("chartTheme data labels", () => {
  it.each(TOKEN_SETS)("colors %s outside labels muted", (_mode, tokens) => {
    const theme = chartTheme(tokens) as Record<string, LabelTheme>;

    const colors = OUTSIDE_LABEL_TYPES.map((type) => theme[type]?.label?.color);

    const muted = tokens.mutedForeground;
    expect(colors).toEqual([muted, muted, muted]);
  });

  it.each(TOKEN_SETS)("sets no text border on %s labels", (_mode, tokens) => {
    const theme = chartTheme(tokens) as Record<string, LabelTheme>;

    const borders = OUTSIDE_LABEL_TYPES.map(
      (type) => theme[type]?.label?.textBorderWidth,
    );

    expect(borders).toEqual([undefined, undefined, undefined]);
  });

  it.each(TOKEN_SETS)(
    "leaves %s heatmap labels to the engine",
    (_m, tokens) => {
      const theme = chartTheme(tokens);

      expect(theme).not.toHaveProperty("heatmap");
    },
  );
});

describe("chartTheme tooltip", () => {
  it.each(TOKEN_SETS)("confines the %s tooltip to its chart", (_m, tokens) => {
    const theme = chartTheme(tokens) as { tooltip?: TooltipTheme };

    const confine = theme.tooltip?.confine;

    expect(confine).toBe(true);
  });

  it.each(TOKEN_SETS)("paints the %s tooltip as a popover", (_m, tokens) => {
    const theme = chartTheme(tokens) as { tooltip?: TooltipTheme };

    const tooltip = theme.tooltip;

    expect(tooltip).toMatchObject({
      backgroundColor: tokens.popover,
      borderColor: tokens.popoverBorder,
      textStyle: { color: tokens.foreground },
    });
  });

  it.each(TOKEN_SETS)(
    "rounds the %s tooltip from the radius scale",
    (_m, tokens) => {
      const theme = chartTheme(tokens) as { tooltip?: TooltipTheme };

      const css = theme.tooltip?.extraCssText;

      expect(css).toBe("border-radius: var(--radius-sm);");
    },
  );
});

describe("chartTheme text", () => {
  it.each(TOKEN_SETS)(
    "sets every %s chart text in the body font",
    (_m, tokens) => {
      const theme = chartTheme({ ...tokens, fontFamily: "Georgia, serif" }) as {
        textStyle?: { fontFamily?: string };
      };

      const fontFamily = theme.textStyle?.fontFamily;

      expect(fontFamily).toBe("Georgia, serif");
    },
  );
});
