import type { Locator, Page } from "@playwright/test";
import { paintedRgb } from "./contrast.js";
import type { Rgb } from "./contrast.js";
import { expect } from "./dev-server.fixture.js";

export type ColorScheme = "light" | "dark";

/** The theme token values, light and dark, as `src/web/src/styles.css` defines them. */
export const TOKENS: Record<ColorScheme, Record<string, string>> = {
  light: {
    "--background": "#ffffff",
    "--foreground": "#171717",
    "--muted": "#f5f5f5",
    "--muted-foreground": "#525252",
    "--muted-foreground-faded": "#737373",
    "--accent": "#f5f5f5",
    "--accent-foreground": "#171717",
    "--border": "#e5e5e5",
    "--border-strong": "#d4d4d4",
    "--separator": "#d4d4d4",
    "--indicator": "#404040",
    "--sidebar": "#fafafa",
    "--sidebar-foreground": "#404040",
    "--sidebar-accent": "#e5e5e5",
    "--overlay": "rgb(0 0 0 / 20%)",
    "--ring": "#737373",
    "--popover": "#ffffff",
    "--popover-border": "#e5e5e5",
    "--input": "#d4d4d4",
    "--field": "#ffffff",
    "--label": "#404040",
    "--primary": "#171717",
    "--primary-foreground": "#ffffff",
    "--secondary": "#e5e5e5",
    "--card": "#ffffff",
    "--card-border": "#e5e5e5",
    "--sparkline": "#a1a1a1",
    "--link": "#155dfc",
    "--positive": "#007a55",
    "--negative": "#c10007",
    "--info-surface": "#eff6ff",
    "--info-border": "#bedbff",
    "--info-foreground": "#1c398e",
    "--success-surface": "#ecfdf5",
    "--success-border": "#a4f4cf",
    "--success-foreground": "#004f3b",
    "--warning-surface": "#fefce8",
    "--warning-border": "#fff085",
    "--warning-foreground": "#733e0a",
    "--destructive-surface": "#fef2f2",
    "--destructive-border": "#ffc9c9",
    "--destructive-foreground": "#82181a",
    "--chart-axis": "#a1a1a1",
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
    "--background": "#0a0a0a",
    "--foreground": "#f5f5f5",
    "--muted": "#171717",
    "--muted-foreground": "#a1a1a1",
    "--muted-foreground-faded": "#a1a1a1",
    "--accent": "#262626",
    "--accent-foreground": "#f5f5f5",
    "--border": "#262626",
    "--border-strong": "#404040",
    "--separator": "#525252",
    "--indicator": "#a1a1a1",
    "--sidebar": "#171717",
    "--sidebar-foreground": "#d4d4d4",
    "--sidebar-accent": "#404040",
    "--overlay": "rgb(0 0 0 / 50%)",
    "--ring": "#a1a1a1",
    "--popover": "#171717",
    "--popover-border": "#404040",
    "--input": "#404040",
    "--field": "#171717",
    "--label": "#d4d4d4",
    "--primary": "#e5e5e5",
    "--primary-foreground": "#171717",
    "--secondary": "#404040",
    "--card": "#171717",
    "--card-border": "#404040",
    "--sparkline": "#737373",
    "--link": "#2b7fff",
    "--positive": "#00d492",
    "--negative": "#ff6467",
    "--info-surface": "#2b7fff1a",
    "--info-border": "#2b7fff33",
    "--info-foreground": "#bedbff",
    "--success-surface": "#00bc7d1a",
    "--success-border": "#00bc7d33",
    "--success-foreground": "#a4f4cf",
    "--warning-surface": "#f0b1001a",
    "--warning-border": "#f0b10033",
    "--warning-foreground": "#fff085",
    "--destructive-surface": "#fb2c361a",
    "--destructive-border": "#fb2c3633",
    "--destructive-foreground": "#ffc9c9",
    "--chart-axis": "#525252",
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

/** A painted chrome colour: which element, which computed property, which token. */
export interface ChromeProbe {
  name: string;
  locate: (page: Page) => Locator;
  property:
    | "backgroundColor"
    | "color"
    | "borderTopColor"
    | "borderBottomColor"
    | "borderRightColor"
    | "borderLeftColor";
  token: string;
}

/**
 * Asserts two painted colours match within one 8-bit step per channel:
 * a translucent tint (`bg-sidebar-accent/60`) is mixed in oklab and then
 * composited, which can round to a neighbouring sRGB value.
 */
export function expectSameColor(
  actual: Rgb,
  expected: Rgb,
  what: string,
): void {
  const off = actual.some((channel, i) => Math.abs(channel - expected[i]!) > 1);
  expect(
    off,
    `${what}: painted ${actual.join(",")}, expected ${expected.join(",")}`,
  ).toBe(false);
}

/**
 * Asserts each probe paints the colour `tokens` holds for its token.
 *
 * @example
 * await expectProbes(page, [{ name: "header rule", locate: (p) => p.locator("header"), property: "borderBottomColor", token: "--border" }], TOKENS.light);
 */
export async function expectProbes(
  page: Page,
  probes: ChromeProbe[],
  tokens: Record<string, string>,
): Promise<void> {
  for (const probe of probes) {
    const computed = await probe
      .locate(page)
      .evaluate(
        (element, property) => getComputedStyle(element)[property],
        probe.property,
      );
    const expected = await paintedRgb(page, tokens[probe.token]!);
    expectSameColor(await paintedRgb(page, computed), expected, probe.name);
  }
}
