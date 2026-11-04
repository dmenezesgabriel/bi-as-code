import type { Locator, Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { chooseLanguage, documentLanguage } from "./language-menu.js";

test.use({ biacProject: "docs" });

const ROUTE = "/sql/translations";

/** The two live tables the page runs: sexes by label, then the weighed count. */
function liveTables(page: Page): Locator {
  return page.locator("main").getByRole("table").filter({ hasText: "Label" });
}

test.describe("the translations the reference runs", () => {
  test("reads English first, binds the sex labels in SQL and shows no error", async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(`${biacDev.url}${ROUTE}`);

    const bySex = liveTables(page).first();
    await expect(bySex).toContainText("Female");
    await expect(bySex).toContainText("165");
    await expect(liveTables(page).nth(1)).toContainText(
      "Penguins that were weighed",
    );
    expect(await documentLanguage(page)).toBe("en");
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("picking Français rewrites the text and the bound SQL values, apostrophe included, and keeps the English fallback", async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(`${biacDev.url}${ROUTE}`);
    await expect(liveTables(page).first()).toContainText("Female");

    await chooseLanguage(page, "Français");

    await expect(liveTables(page).first()).toContainText("Femelle");
    await expect(liveTables(page).nth(1)).toContainText(
      "Pingouins qu'on a pesés",
    );
    await expect(page.locator("main")).toContainText(
      "This sentence has no French translation, so a French reader sees it in English.",
    );
    expect(new URL(page.url()).searchParams.get("lang")).toBe("fr");
    expect(await documentLanguage(page)).toBe("fr");
    expect(errors).toEqual([]);
  });

  test("a ?lang=fr link opens in French and the pick outlives the link", async ({
    page,
    biacDev,
  }) => {
    await page.goto(`${biacDev.url}${ROUTE}?lang=fr`);
    await expect(liveTables(page).first()).toContainText("Femelle");
    await chooseLanguage(page, "Français");

    await page.goto(`${biacDev.url}${ROUTE}`);

    await expect(liveTables(page).first()).toContainText("Femelle");
    expect(await documentLanguage(page)).toBe("fr");
  });
});
