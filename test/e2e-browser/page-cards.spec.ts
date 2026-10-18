import type { Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PAGE_SWAP_LOGGED_PATH,
  rewriteUntilServerLogs,
} from "../lib/write-until-logged.js";
import { contrastRatio, readRootToken } from "./contrast.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

/** Counts of the cards a carded page draws, read off the live DOM. */
function readCards(page: Page) {
  return page.evaluate(() => {
    const inCard = (selector: string) =>
      [...document.querySelectorAll(selector)].some(
        (element) => element.closest("[data-widget-card]") !== null,
      );
    return {
      cards: document.querySelectorAll("[data-widget-card]").length,
      nested: document.querySelectorAll("[data-widget-card] [data-widget-card]")
        .length,
      perTabPanel: [...document.querySelectorAll("[role=tabpanel]")].map(
        (panel) => panel.querySelectorAll("[data-widget-card]").length,
      ),
      filterBarCarded: inCard("[data-filter-bar]"),
      calloutCarded: inCard("[role=note]"),
      tint: getComputedStyle(
        document.querySelector("[data-cards]") ?? document.body,
      ).backgroundColor,
    };
  });
}

const cardCount = async (page: Page) => (await readCards(page)).cards;

test("front-matter cards: true cards each chart, table and big value in place, and a bad value shows its error", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${biacDev.url}/weekly-review`);
  const heading = page.getByRole("heading", {
    level: 1,
    name: "Weekly review",
  });
  await expect(heading).toBeVisible();
  expect(await cardCount(page)).toBe(0);
  await page.evaluate(() => {
    (window as unknown as { __probe: string }).__probe = "kept";
  });

  const file = join(biacDev.projectDir, "pages/weekly-review.md");
  const original = readFileSync(file, "utf8");
  const withCards = (value: string) =>
    original.replace("title: Weekly review\n", `$&cards: ${value}\n`);
  await rewriteUntilServerLogs({
    rewrite: () => writeFileSync(file, withCards("true")),
    log: biacDev.log,
    loggedPath: PAGE_SWAP_LOGGED_PATH,
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  // 3 big values, 7 charts and 3 tables — one in each of the two tabs.
  await expect.poll(() => cardCount(page), { timeout: 20_000 }).toBe(13);
  expect(await readCards(page)).toMatchObject({
    nested: 0,
    perTabPanel: [1, 1],
    filterBarCarded: false,
    calloutCarded: false,
    tint: "rgb(250, 250, 250)",
  });
  expect(
    await page.evaluate(
      () => (window as unknown as { __probe?: string }).__probe,
    ),
  ).toBe("kept");

  writeFileSync(file, withCards("yes please"));
  await expect(page.getByRole("alert")).toContainText(
    'cards: expected a boolean, got "yes please"',
    { timeout: 20_000 },
  );

  writeFileSync(file, original);
  await expect(heading).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => cardCount(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("the card-mode background keeps faded text at 4.5:1 and sits under the cards, light and dark", async ({
  page,
  biacDev,
}) => {
  const file = join(biacDev.projectDir, "pages/weekly-review.md");
  const original = readFileSync(file, "utf8");
  writeFileSync(
    file,
    original.replace("title: Weekly review\n", "$&cards: true\n"),
  );
  for (const [scheme, tint] of [
    ["light", "rgb(250, 250, 250)"],
    ["dark", "rgb(10, 10, 10)"],
  ] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`${biacDev.url}/weekly-review`);
    await expect.poll(() => cardCount(page), { timeout: 20_000 }).toBe(13);
    expect((await readCards(page)).tint).toBe(tint);
    const faded = await readRootToken(page, "--muted-foreground-faded");
    const card = await readRootToken(page, "--card");
    // WCAG 2.2 SC 1.4.3: the faded label text outside the cards.
    expect(await contrastRatio(page, faded, tint)).toBeGreaterThanOrEqual(4.5);
    // The card must differ from the page or the tint, or its border, does
    // nothing; dark cards are lighter than the page.
    expect(await contrastRatio(page, card, tint)).toBeGreaterThan(1);
  }
  writeFileSync(file, original);
});

test("biac.config.ts layout.cards cards every page, and a page's cards: false opts out", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const configFile = join(biacDev.projectDir, "biac.config.ts");
  const validConfig = readFileSync(configFile, "utf8");
  const index = join(biacDev.projectDir, "pages/index.md");
  const originalIndex = readFileSync(index, "utf8");
  writeFileSync(
    configFile,
    validConfig.replace("{\n", "{\n  layout: { cards: true },\n"),
  );
  writeFileSync(
    index,
    originalIndex.replace("title: Orders overview\n", "$&cards: false\n"),
  );

  await page.goto(`${biacDev.url}/weekly-review`);
  await expect.poll(() => cardCount(page), { timeout: 20_000 }).toBe(13);
  await page
    .getByRole("navigation", { name: "Site navigation" })
    .getByRole("link", { name: "Orders overview" })
    .click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Orders overview" }),
  ).toBeVisible();
  expect(await readCards(page)).toMatchObject({
    cards: 0,
    tint: "rgba(0, 0, 0, 0)",
  });

  writeFileSync(configFile, validConfig);
  writeFileSync(index, originalIndex);
  expect(errors).toEqual([]);
});
