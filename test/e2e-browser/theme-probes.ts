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
    "--chart-axis": "#a1a1a1",
    "--chart-label-inside": "#ffffff",
    "--chart-1": "#2563eb",
    "--chart-2": "#059669",
    "--chart-3": "#d97706",
    "--chart-4": "#dc2626",
    "--chart-5": "#7c3aed",
    "--chart-6": "#0891b2",
    "--chart-7": "#db2777",
    "--chart-8": "#65a30d",
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
    "--ring": "#737373",
    "--popover": "#171717",
    "--popover-border": "#404040",
    "--input": "#404040",
    "--field": "#171717",
    "--label": "#d4d4d4",
    "--primary": "#e5e5e5",
    "--primary-foreground": "#171717",
    "--secondary": "#404040",
    "--chart-axis": "#525252",
    "--chart-label-inside": "#ffffff",
    "--chart-1": "#2563eb",
    "--chart-2": "#059669",
    "--chart-3": "#d97706",
    "--chart-4": "#dc2626",
    "--chart-5": "#7c3aed",
    "--chart-6": "#0891b2",
    "--chart-7": "#db2777",
    "--chart-8": "#65a30d",
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
