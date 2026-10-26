import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { rewriteUntilServerLogs } from "../lib/write-until-logged.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { chooseLanguage } from "./language-menu.js";

/** The search documents accept their own updates, so vite logs them by id. */
const SEARCH_SWAP_LOGGED_PATH = "/@id/__x00__virtual:biac-search";

/** Opens `url` at 1280 px; returns its console errors, the nav and the box. */
async function openAtDesktop(
  page: Page,
  url: string,
): Promise<{ errors: string[]; nav: Locator; box: Locator }> {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(url);
  const nav = page.getByRole("navigation", { name: "Site navigation" });
  const box = nav.getByRole("combobox", { name: "Search pages" });
  return { errors, nav, box };
}

test("the sidebar search box finds pages by body word, ranks titles first, and opens a result with the keyboard", async ({
  page,
  biacDev,
}) => {
  const { errors, nav, box } = await openAtDesktop(page, biacDev.url);
  const results = nav.getByRole("option");

  await box.fill("fulfilment");
  await expect(results).toHaveText(["Allocation"]);
  await expect(results.first()).toHaveAttribute("href", "/nested/allocation/");

  await box.fill("");
  await expect(results).toHaveCount(0);

  await box.fill("weekly");
  await expect(results.first()).toHaveText("Weekly orders");
  await expect(results.nth(1)).toHaveText("Weekly review");
  await box.press("ArrowDown");
  await expect(results.nth(1)).toHaveAttribute("data-highlighted", "");
  await box.press("Enter");

  await expect(page).toHaveURL(/\/weekly-review\/$/);
  await expect(box).toHaveValue("");
  expect(errors).toEqual([]);
});

test("/ and Ctrl-K focus the search box, Escape clears then leaves it, and results take the page links' place", async ({
  page,
  biacDev,
}) => {
  const { errors, nav, box } = await openAtDesktop(page, biacDev.url);
  const pageLink = nav.getByRole("link", { name: "Weekly review" });
  const status = nav.getByRole("status");
  // The box mounts in the same commit that starts listening for shortcuts.
  await expect(box).toBeVisible();

  await page.keyboard.press("/");
  await expect(box).toBeFocused();
  await box.pressSequentially("fulfilmant");
  await expect(nav.getByRole("option")).toHaveText(["Allocation"]);
  await expect(status).toHaveText("1 result");
  await expect(pageLink).toBeHidden();

  await box.fill("fulfil");
  await expect(nav.getByRole("option")).toHaveText(["Allocation"]);
  await box.fill("zzzz");
  await expect(status).toHaveText("No results");

  await box.press("Escape");
  await expect(box).toHaveValue("");
  await expect(pageLink).toBeVisible();
  await box.press("Escape");
  await expect(box).not.toBeFocused();

  await box.fill("weekly");
  await box.blur();
  await page.keyboard.press("Control+k");
  await expect(box).toBeFocused();
  expect(
    await box.evaluate((input: HTMLInputElement) =>
      input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0),
    ),
  ).toBe("weekly");
  expect(errors).toEqual([]);
});

test("below lg, / opens the drawer and focuses the search box; Escape clears it, then closes the drawer", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(biacDev.url);
  const toggle = page.getByRole("button", { name: "Toggle sidebar" });
  // The closed drawer is `visibility: hidden`, out of the accessibility tree.
  const box = page.getByRole("combobox", {
    name: "Search pages",
    includeHidden: true,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(box).toBeAttached();

  await page.keyboard.press("/");

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(box).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.keyboard.type("weekly");
  await page.keyboard.press("Escape");
  await expect(box).toHaveValue("");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(errors).toEqual([]);
});

test("a saved page's keywords reach the open search box in place, and index: false takes the page out", async ({
  page,
  biacDev,
}) => {
  const { errors, nav, box } = await openAtDesktop(page, biacDev.url);
  await box.fill("tariff");
  await expect(nav.getByText("No results")).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __probe: string }).__probe = "kept";
  });
  const file = join(biacDev.projectDir, "pages/nested/allocation.md");
  const original = readFileSync(file, "utf8");
  const saveWith = (line: string) =>
    rewriteUntilServerLogs({
      rewrite: () =>
        writeFileSync(file, original.replace("---\n", `---\n${line}\n`)),
      log: biacDev.log,
      loggedPath: SEARCH_SWAP_LOGGED_PATH,
      attemptMs: 3_000,
      timeoutMs: 20_000,
    });

  await saveWith("keywords: tariff");
  await expect(nav.getByRole("option")).toHaveText(["Allocation"]);

  await saveWith("index: false");
  await box.fill("fulfilment");
  await expect(nav.getByText("No results")).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { __probe?: string }).__probe,
    ),
  ).toBe("kept");
  expect(errors).toEqual([]);
});

test("the search box searches the page's language: ?lang=fr finds French words, English does not", async ({
  page,
  biacDev,
}) => {
  const { errors, nav, box } = await openAtDesktop(
    page,
    `${biacDev.url}weekly-review?lang=fr`,
  );

  await box.fill("hebdomadaire");
  await expect(nav.getByRole("option")).toHaveText(["Weekly review"]);

  await box.fill("");
  await chooseLanguage(page, "English");
  await box.fill("hebdomadaire");
  await expect(nav.getByText("No results")).toBeVisible();
  expect(errors).toEqual([]);
});
