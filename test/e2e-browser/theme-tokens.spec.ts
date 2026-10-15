import type { Locator, Page } from "@playwright/test";
import { effectiveBackground, paintedRgb, readRootToken } from "./contrast.js";
import type { Rgb } from "./contrast.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

type ColorScheme = "light" | "dark";

/** The theme token values, light and dark, as `src/web/src/styles.css` defines them. */
const TOKENS: Record<ColorScheme, Record<string, string>> = {
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
interface ChromeProbe {
  name: string;
  locate: (page: Page) => Locator;
  property:
    | "backgroundColor"
    | "color"
    | "borderBottomColor"
    | "borderRightColor"
    | "borderLeftColor";
  token: string;
}

const WEEKLY_REVIEW_PROBES: ChromeProbe[] = [
  {
    name: "shell surface",
    locate: (p) => p.locator("#root > div"),
    property: "backgroundColor",
    token: "--background",
  },
  {
    name: "shell text",
    locate: (p) => p.locator("#root > div"),
    property: "color",
    token: "--foreground",
  },
  {
    name: "header surface",
    locate: (p) => p.locator("header"),
    property: "backgroundColor",
    token: "--background",
  },
  {
    name: "header rule",
    locate: (p) => p.locator("header"),
    property: "borderBottomColor",
    token: "--border",
  },
  {
    name: "sidebar surface",
    locate: sidebar,
    property: "backgroundColor",
    token: "--sidebar",
  },
  {
    name: "sidebar rule",
    locate: sidebar,
    property: "borderRightColor",
    token: "--border",
  },
  {
    name: "sidebar group",
    locate: (p) => sidebar(p).locator("summary"),
    property: "color",
    token: "--sidebar-foreground",
  },
  {
    name: "sidebar link",
    locate: (p) => sidebar(p).getByRole("link", { name: "Orders overview" }),
    property: "color",
    token: "--muted-foreground",
  },
  {
    name: "sidebar active link",
    locate: (p) => sidebar(p).locator("[aria-current=page]"),
    property: "color",
    token: "--foreground",
  },
  {
    name: "theme button",
    locate: (p) =>
      p.getByRole("button", { name: /Switch to (dark|light) mode/ }),
    property: "color",
    token: "--muted-foreground",
  },
  {
    name: "breadcrumb rule",
    locate: breadcrumb,
    property: "borderLeftColor",
    token: "--border",
  },
  {
    name: "breadcrumb leaf",
    locate: (p) => breadcrumb(p).locator("[aria-current=page]"),
    property: "color",
    token: "--foreground",
  },
  {
    name: "ToC label",
    locate: (p) => toc(p).locator("p"),
    property: "color",
    token: "--muted-foreground-faded",
  },
  {
    name: "ToC rail",
    locate: (p) => toc(p).locator("ul"),
    property: "borderLeftColor",
    token: "--border",
  },
  {
    name: "ToC indicator",
    locate: (p) => p.getByTestId("toc-highlight"),
    property: "backgroundColor",
    token: "--indicator",
  },
  {
    name: "ToC active entry",
    locate: (p) => toc(p).locator("[aria-current=location]"),
    property: "color",
    token: "--foreground",
  },
  {
    name: "ToC entry",
    locate: (p) => toc(p).locator("a:not([aria-current])").first(),
    property: "color",
    token: "--muted-foreground-faded",
  },
];

const NESTED_PAGE_PROBES: ChromeProbe[] = [
  {
    name: "breadcrumb separator",
    locate: (p) => breadcrumb(p).locator("[aria-hidden=true]").first(),
    property: "color",
    token: "--separator",
  },
  {
    name: "breadcrumb directory",
    locate: (p) => breadcrumb(p).locator("li span:not([aria-hidden])").first(),
    property: "color",
    token: "--muted-foreground-faded",
  },
];

/** The active sidebar link paints `--sidebar-accent` at 60 % over `--sidebar`. */
const ACTIVE_LINK_SURFACE: Record<ColorScheme, Rgb> = {
  light: [237, 237, 237],
  dark: [48, 48, 48],
};

function sidebar(page: Page): Locator {
  return page.locator("aside").filter({
    has: page.getByRole("navigation", { name: "Site navigation" }),
  });
}

function breadcrumb(page: Page): Locator {
  return page.getByRole("navigation", { name: "breadcrumb" });
}

function toc(page: Page): Locator {
  return page.getByRole("navigation", { name: "On this page" });
}

/**
 * Asserts two painted colours match within one 8-bit step per channel:
 * a translucent tint (`bg-sidebar-accent/60`) is mixed in oklab and then
 * composited, which can round to a neighbouring sRGB value.
 */
function expectSameColor(actual: Rgb, expected: Rgb, what: string): void {
  const off = actual.some((channel, i) => Math.abs(channel - expected[i]!) > 1);
  expect(
    off,
    `${what}: painted ${actual.join(",")}, expected ${expected.join(",")}`,
  ).toBe(false);
}

async function expectProbes(
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

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });
    const tokens = TOKENS[colorScheme];

    test("the root defines every chrome token at its value", async ({
      page,
      biacDev,
    }) => {
      await page.goto(`${biacDev.url}weekly-review`);
      await expect(page.locator("header")).toBeVisible();
      for (const [token, value] of Object.entries(tokens)) {
        const defined = await readRootToken(page, token);
        expect(defined, `${token} on :root`).not.toBe("");
        expectSameColor(
          await paintedRgb(page, defined),
          await paintedRgb(page, value),
          token,
        );
      }
    });

    test("the chrome paints from the tokens", async ({ page, biacDev }) => {
      const errors = collectConsoleErrors(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`${biacDev.url}weekly-review`);
      await expect(page.getByTestId("toc-highlight")).toBeVisible();
      await expectProbes(page, WEEKLY_REVIEW_PROBES, tokens);
      const activeLink = sidebar(page).locator("[aria-current=page]");
      const surface = await effectiveBackground(activeLink);
      expectSameColor(
        await paintedRgb(page, surface),
        ACTIVE_LINK_SURFACE[colorScheme],
        "sidebar active surface",
      );

      await page.goto(`${biacDev.url}nested/page`);
      await expect(breadcrumb(page)).toBeVisible();
      await expectProbes(page, NESTED_PAGE_PROBES, tokens);
      expect(errors).toEqual([]);
    });
  });
}
