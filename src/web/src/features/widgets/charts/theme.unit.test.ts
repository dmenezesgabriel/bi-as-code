import { describe, expect, it } from "vitest";
import type { ThemeMode } from "../../chrome/theme";
import { chartTheme, themeTokens } from "./theme";

interface LabelTheme {
  readonly label?: {
    readonly color?: string;
    readonly textBorderWidth?: number;
  };
}

const MODES: readonly ThemeMode[] = ["light", "dark"];
const OUTSIDE_LABEL_TYPES = ["bar", "line", "scatter"] as const;

describe("chartTheme data labels", () => {
  it.each(MODES)("colors %s bar, line and scatter labels muted", (mode) => {
    const theme = chartTheme(mode) as Record<string, LabelTheme>;

    const colors = OUTSIDE_LABEL_TYPES.map((type) => theme[type]?.label?.color);

    const muted = themeTokens(mode).textMuted;
    expect(colors).toEqual([muted, muted, muted]);
  });

  it.each(MODES)("sets no text border on %s labels", (mode) => {
    const theme = chartTheme(mode) as Record<string, LabelTheme>;

    const borders = OUTSIDE_LABEL_TYPES.map(
      (type) => theme[type]?.label?.textBorderWidth,
    );

    expect(borders).toEqual([undefined, undefined, undefined]);
  });

  it.each(MODES)("leaves %s heatmap cell labels to the engine", (mode) => {
    const theme = chartTheme(mode);

    expect(theme).not.toHaveProperty("heatmap");
  });
});
