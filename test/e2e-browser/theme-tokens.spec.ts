import type { Locator, Page } from "@playwright/test";
import { effectiveBackground, paintedRgb, readRootToken } from "./contrast.js";
import type { Rgb } from "./contrast.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { expectProbes, expectSameColor, TOKENS } from "./theme-probes.js";
import type { ChromeProbe, ColorScheme } from "./theme-probes.js";

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
