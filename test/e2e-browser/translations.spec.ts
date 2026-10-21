import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  PAGE_SWAP_LOGGED_PATH,
  rewriteUntilServerLogs,
} from "../lib/write-until-logged.js";
import {
  collectConsoleErrors,
  expect,
  firstRowCells,
  resultTables,
  test,
} from "./dev-server.fixture.js";

// The /weekly-review headings and titles the example project reads from
// translations.yaml, in page order.
const EN_HEADINGS = [
  "Weekly review",
  "Overview",
  "Regional split",
  "Order mix",
  "Order size",
  "Trend lines",
  "Takeaways",
];
const FR_HEADINGS = [
  "Revue hebdomadaire",
  "Vue d'ensemble",
  "Répartition régionale",
  "Composition des commandes",
  "Taille des commandes",
  "Tendances",
  "À retenir",
];

function headings(page: Page) {
  return page.locator("main h1, main h2");
}

/** Saves translations.yaml with `fr` declared first: French becomes the default. */
function frenchFirst(source: string): string {
  const frStart = source.indexOf("\nfr:\n");
  const header = source.slice(0, source.indexOf("en:\n"));
  const en = source.slice(header.length, frStart + 1);
  return `${header}${source.slice(frStart + 1)}${en}`;
}

async function saveTranslations(
  biacDev: { projectDir: string; log(): readonly string[] },
  edit: (source: string) => string,
): Promise<void> {
  const file = join(biacDev.projectDir, "translations.yaml");
  const source = edit(readFileSync(file, "utf8"));
  await rewriteUntilServerLogs({
    rewrite: () => writeFileSync(file, source),
    log: biacDev.log,
    loggedPath: PAGE_SWAP_LOGGED_PATH,
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
}

test("weekly-review reads its headings and titles in the first declared language", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);

  await page.goto(`${biacDev.url}weekly-review`);

  await expect(headings(page)).toHaveText(EN_HEADINGS);
  await expect(page.getByText("Search regions", { exact: true })).toBeVisible();
  await expect(page.locator("main h3")).toContainText(["Quarter detail"]);
  expect(errors).toEqual([]);
});

test("saving a French-first translations.yaml swaps the page to French in place", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);
  await expect(headings(page)).toHaveText(EN_HEADINGS);
  await page.evaluate(() => {
    (window as unknown as { __probe: string }).__probe = "kept";
  });

  await saveTranslations(biacDev, frenchFirst);

  await expect(headings(page)).toHaveText(FR_HEADINGS);
  // fr leaves `methodology` out, so it shows its en value.
  await expect(
    page.getByRole("button", { name: "Methodology", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { __probe?: string }).__probe,
    ),
  ).toBe("kept");
  expect(errors).toEqual([]);
});

/** The west_orders fence's result: the last live table on /weekly-review. */
function westOrders(page: Page) {
  return resultTables(page).last();
}

test("a sql fence binds its translation, apostrophe and all, in place", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);
  await expect(westOrders(page).locator("tbody tr")).toHaveCount(1);
  expect(await firstRowCells(westOrders(page))).toEqual(["West", "140"]);

  await saveTranslations(biacDev, frenchFirst);

  await expect(westOrders(page).locator("tbody td").first()).toHaveText(
    "l'Ouest",
  );
  expect(await firstRowCells(westOrders(page))).toEqual(["l'Ouest", "140"]);
  expect(errors).toEqual([]);
});

test("a sql fence naming an unknown translation key shows the token", async ({
  page,
  biacDev,
}) => {
  const pageFile = join(biacDev.projectDir, "pages/weekly-review.md");
  writeFileSync(
    pageFile,
    readFileSync(pageFile, "utf8").replace(
      "{{$translations.region_west}}",
      "{{$translations.region_wst}}",
    ),
  );

  await page.goto(`${biacDev.url}weekly-review`);

  await expect(
    page.getByText(
      "Undefined translation key {{$translations.region_wst}} — expected a key of translations.yaml whose value is text",
    ),
  ).toBeVisible();
});

test("a misspelled translation key fails the page at its line", async ({
  page,
  biacDev,
}) => {
  const pageFile = join(biacDev.projectDir, "pages/weekly-review.md");
  writeFileSync(
    pageFile,
    readFileSync(pageFile, "utf8").replace(
      "## {$translations.overview}",
      "## {$translations.overveiw}",
    ),
  );

  await page.goto(`${biacDev.url}weekly-review`);

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("This page failed to compile");
  await expect(alert).toContainText(/pages\/weekly-review\.md:25:5/);
  await expect(alert).toContainText(
    "Undefined translation key: $translations.overveiw (did you mean $translations.overview?)",
  );
});

test("a malformed translations.yaml fails the page naming the file's line", async ({
  page,
  biacDev,
}) => {
  const file = join(biacDev.projectDir, "translations.yaml");
  writeFileSync(
    file,
    readFileSync(file, "utf8").replace("  overview:", " overview:"),
  );

  await page.goto(`${biacDev.url}weekly-review`);

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("This page failed to compile");
  await expect(alert).toContainText(/Invalid translations\.yaml:\d+:\d+/);
});
