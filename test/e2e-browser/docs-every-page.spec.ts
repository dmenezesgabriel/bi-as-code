import type { Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { chartHosts, readyCharts } from "./echart-hosts.js";
import { docsRoutes, pageOverflow } from "./docs-pages.js";

test.use({ biacProject: "docs" });

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
] as const;
const COLOR_SCHEMES = ["light", "dark"] as const;

/**
 * Waits for the page's queries to settle and every shown chart to finish
 * painting. A chart in an unselected tab panel is mounted but hidden and
 * never paints (`/layout/tabs`), so only visible hosts are counted.
 */
async function settled(page: Page): Promise<void> {
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator("main [role=status]")).toHaveCount(0);
  const shown = chartHosts(page).locator("visible=true");
  await expect(readyCharts(page).locator("visible=true")).toHaveCount(
    await shown.count(),
  );
}

/**
 * Every docs page, in both colour schemes at phone and desktop width, scrolls
 * nowhere sideways, shows no alert and logs no console error — the docs
 * site's responsive and dark-mode promise, measured on every route.
 */
for (const route of docsRoutes()) {
  test(`${route} fits the window and logs no error in both schemes at 375 and 1280 px`, async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);

    for (const viewport of VIEWPORTS) {
      for (const colorScheme of COLOR_SCHEMES) {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme });
        await page.goto(`${biacDev.url}${route}`);
        await settled(page);

        const label = `${route} at ${viewport.width} px, ${colorScheme}`;
        expect(await pageOverflow(page), label).toBe(0);
        await expect(page.locator("main [role=alert]"), label).toHaveCount(0);
      }
    }
    expect(errors).toEqual([]);
  });
}
