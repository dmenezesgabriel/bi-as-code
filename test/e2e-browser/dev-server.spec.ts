import type { Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./dev-server.fixture.js";

/**
 * Console errors and page errors fail every test — a clean console is part
 * of "renders correctly", not an optional extra.
 */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

test("renders the index page: title, prose, gfm table, highlighted sql fence", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(biacDev.url);

  await expect(page).toHaveTitle("Orders overview");
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();
  await expect(
    page.getByText("Weekly order volume across regions."),
  ).toBeVisible();

  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table).toContainText("West");

  const fence = page.locator("pre.shiki");
  await expect(fence).toBeVisible();
  await expect(fence).toContainText("select region");
  await expect(fence.locator('span[style*="color"]').first()).toBeAttached();

  expect(errors).toEqual([]);
});

test("navigates to a linked page client-side, with no reload", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(biacDev.url);
  await page.evaluate(() => Object.assign(window, { __navMarker: "kept" }));

  await page.getByRole("link", { name: "region detail page" }).click();

  await expect(page).toHaveURL(/\/nested\/page$/);
  await expect(
    page.getByRole("heading", { name: "Region detail" }),
  ).toBeVisible();
  // A full reload would have wiped the marker; its survival proves the
  // router navigated inside the live SPA.
  expect(await page.evaluate(() => Reflect.get(window, "__navMarker"))).toBe(
    "kept",
  );
  expect(errors).toEqual([]);
});

test("updates on page edit and serves a page added while running", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(biacDev.url);
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();

  const indexFile = join(biacDev.projectDir, "pages/index.md");
  const original = readFileSync(indexFile, "utf8");
  // Rewriting identical bytes still bumps mtime, so each poll attempt
  // re-fires the chokidar event — the rewrite cannot be missed by a watcher
  // that came up between the previous attempt and this one.
  await expect(async () => {
    writeFileSync(
      indexFile,
      original.replace("# Orders overview", "# Edited overview"),
    );
    await expect(
      page.getByRole("heading", { name: "Edited overview" }),
    ).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });

  // The watcher is live now (the edit landed), so a single write suffices;
  // the manifest regenerates on the next request once invalidated.
  writeFileSync(
    join(biacDev.projectDir, "pages/new-page.md"),
    "---\ntitle: Fresh page\n---\n# Fresh page\n",
  );
  await expect(async () => {
    await page.goto(`${biacDev.url}new-page`);
    await expect(page.getByRole("heading", { name: "Fresh page" })).toBeVisible(
      { timeout: 3_000 },
    );
  }).toPass({ timeout: 20_000 });

  expect(errors).toEqual([]);
});

test("renders a styled 404 for an unknown route", async ({ page, biacDev }) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}no-such-page`);

  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Page not found");

  await page.getByRole("link", { name: "Back to index" }).click();
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
