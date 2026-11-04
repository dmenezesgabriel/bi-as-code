import type { Locator, Page } from "@playwright/test";
import { siteSearchExamples } from "../lib/site-search-examples.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { chooseLanguage } from "./language-menu.js";

test.use({ biacProject: "docs" });

const ROUTE = "/sql/site-search";

/** The sidebar's search box and the results it lists. */
function searchBox(page: Page): { box: Locator; results: Locator } {
  const nav = page.getByRole("navigation", { name: "Site navigation" });
  return {
    box: nav.getByRole("combobox", { name: "Search pages" }),
    results: nav.getByRole("option"),
  };
}

/** Opens the page at 1280 px and returns its search box and results. */
async function openAtDesktop(
  page: Page,
  url: string,
): Promise<{ box: Locator; results: Locator }> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${url}${ROUTE}`);
  return searchBox(page);
}

test.describe("the site search the reference describes", () => {
  test("every example query lists its page first, and a page with index: false never appears", async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    const { box, results } = await openAtDesktop(page, biacDev.url);

    for (const { query, first } of siteSearchExamples()) {
      await box.fill(query);
      await expect(results.first()).toHaveText(first);
    }

    await box.fill("branded");
    await expect(results.first()).toBeVisible();
    await expect(
      results.filter({ hasText: "Branded page example" }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("Enter on the highlighted result opens its page and clears the box", async ({
    page,
    biacDev,
  }) => {
    const { box, results } = await openAtDesktop(page, biacDev.url);

    await box.fill("histogramm");
    await expect(results.first()).toHaveText("Histogram");
    await box.press("Enter");

    await expect(page).toHaveURL(/\/components\/histogram\/$/);
    await expect(box).toHaveValue("");
  });

  test("the greeting the page spells as a translation key is found in the reader's language only", async ({
    page,
    biacDev,
  }) => {
    const { box, results } = await openAtDesktop(page, biacDev.url);
    const here = results.filter({ hasText: "Site search" });

    await box.fill("hello");
    await expect(here).toHaveCount(1);
    await chooseLanguage(page, "Français");
    await box.fill("bonjour");
    await expect(here).toHaveCount(1);
    await box.fill("hello");
    await expect(here).toHaveCount(0);
  });

  test("at 375 px / opens the drawer on the box, a query lists its page, and nothing overflows", async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${biacDev.url}${ROUTE}`);
    const { results } = searchBox(page);
    // The closed drawer is `visibility: hidden`, out of the accessibility tree.
    const box = page.getByRole("combobox", {
      name: "Search pages",
      includeHidden: true,
    });

    // The box mounts in the same commit that starts listening for shortcuts.
    await expect(box).toBeAttached();

    await page.keyboard.press("/");
    await expect(box).toBeFocused();
    await page.keyboard.type("hist");

    await expect(results.first()).toHaveText("Histogram");
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBe(0);
    expect(errors).toEqual([]);
  });
});
