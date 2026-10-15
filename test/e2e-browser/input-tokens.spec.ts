import type { Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { expectProbes, TOKENS } from "./theme-probes.js";
import type { ChromeProbe } from "./theme-probes.js";

function sliderThumb(page: Page) {
  return page.getByRole("slider", { name: "Minimum" }).locator("..");
}

/** The closed input widgets on `/weekly-review`, one probe per painted colour. */
const INPUT_PROBES: ChromeProbe[] = [
  {
    name: "dropdown surface",
    locate: (p) => p.getByRole("combobox", { name: "Region" }),
    property: "backgroundColor",
    token: "--field",
  },
  {
    name: "dropdown placeholder",
    locate: (p) => p.getByRole("combobox", { name: "Region" }),
    property: "color",
    token: "--muted-foreground-faded",
  },
  {
    name: "dropdown border",
    locate: (p) => p.getByRole("combobox", { name: "Region" }),
    property: "borderTopColor",
    token: "--input",
  },
  {
    name: "date range label",
    locate: (p) => p.locator("label[for=ordered]"),
    property: "color",
    token: "--label",
  },
  {
    name: "date range text",
    locate: (p) => p.locator("#ordered"),
    property: "color",
    token: "--foreground",
  },
  {
    name: "date range border",
    locate: (p) => p.locator("#ordered"),
    property: "borderTopColor",
    token: "--input",
  },
  {
    name: "text input surface",
    locate: (p) => p.locator("#q"),
    property: "backgroundColor",
    token: "--field",
  },
  {
    name: "slider track",
    locate: (p) => sliderThumb(p).locator(".."),
    property: "backgroundColor",
    token: "--secondary",
  },
  {
    name: "slider indicator",
    locate: (p) => sliderThumb(p).locator("xpath=../*[1]"),
    property: "backgroundColor",
    token: "--primary",
  },
  {
    name: "slider thumb ring",
    locate: sliderThumb,
    property: "borderTopColor",
    token: "--primary",
  },
  {
    name: "slider thumb surface",
    locate: sliderThumb,
    property: "backgroundColor",
    token: "--field",
  },
  {
    name: "toggle track (off)",
    locate: (p) => p.getByRole("switch", { name: "Large orders only" }),
    property: "backgroundColor",
    token: "--secondary",
  },
  {
    name: "toggle row border",
    locate: (p) => p.locator("label[for='large_orders-face']").locator(".."),
    property: "borderTopColor",
    token: "--input",
  },
];

/** The open date range popup. */
const POPUP_PROBES: ChromeProbe[] = [
  {
    name: "popup surface",
    locate: (p) => p.locator("[aria-label='Ordered range']"),
    property: "backgroundColor",
    token: "--popover",
  },
  {
    name: "popup border",
    locate: (p) => p.locator("[aria-label='Ordered range']"),
    property: "borderTopColor",
    token: "--input",
  },
];

/** A colour per token no Tailwind tone paints, to prove a probe reads its token. */
const SENTINELS: Record<string, string> = {
  "--input": "#ff0000",
  "--field": "#00ff00",
  "--label": "#0000ff",
  "--primary": "#ff00ff",
  "--secondary": "#00ffff",
  "--foreground": "#ffff00",
  "--muted-foreground-faded": "#ff8000",
  "--popover": "#8000ff",
};

async function openWeeklyReview(page: Page, url: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${url}weekly-review`);
  await expect(page.getByRole("slider", { name: "Minimum" })).toBeVisible();
}

async function openDateRange(page: Page): Promise<void> {
  await page.locator("#ordered").click();
  await expect(page.locator("[aria-label='Ordered range']")).toBeVisible();
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });
    const tokens = TOKENS[colorScheme];

    test("the inputs paint from the tokens", async ({ page, biacDev }) => {
      const errors = collectConsoleErrors(page);
      await openWeeklyReview(page, biacDev.url);
      await expectProbes(page, INPUT_PROBES, tokens);
      await openDateRange(page);
      await expectProbes(page, POPUP_PROBES, tokens);
      expect(errors).toEqual([]);
    });

    test("the inputs follow a changed token", async ({ page, biacDev }) => {
      await openWeeklyReview(page, biacDev.url);
      await page.evaluate((sentinels) => {
        for (const [token, value] of Object.entries(sentinels)) {
          document.documentElement.style.setProperty(token, value);
        }
      }, SENTINELS);
      const changed = { ...tokens, ...SENTINELS };
      await expectProbes(page, INPUT_PROBES, changed);
      await openDateRange(page);
      await expectProbes(page, POPUP_PROBES, changed);
    });
  });
}
