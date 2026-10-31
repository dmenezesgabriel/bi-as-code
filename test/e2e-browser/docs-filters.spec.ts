import {
  collectConsoleErrors,
  expect,
  resultTables,
  test,
  urlParam,
} from "./dev-server.fixture.js";
import type { Page } from "@playwright/test";

test.use({ biacProject: "docs" });

test("a Dropdown pick on its reference page narrows the table, rides the URL and survives a reload", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}/filters/dropdown`);
  const island = page.getByRole("combobox", { name: "Island" }).first();
  const rows = resultTables(page).first().locator("tbody tr");
  // Five island × species pairs; Biscoe holds two of them.
  await expect(rows).toHaveCount(5);

  await expect(island).toBeEnabled();
  await island.click();
  await page.getByRole("option", { name: "Biscoe" }).click();

  expect(urlParam(page, "island")).toBe("Biscoe");
  await expect(rows).toHaveCount(2);

  await page.reload();
  await expect(island).toHaveText("Biscoe");
  await expect(rows).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("a Search on its reference page narrows the table as typed, rides the URL and survives a reload", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}/filters/search`);
  const species = page.getByRole("searchbox", { name: "Species" }).first();
  const rows = resultTables(page).first().locator("tbody tr");
  // Five island × species pairs; Gentoo lives on Biscoe alone.
  await expect(rows).toHaveCount(5);

  await species.fill("gen");
  await species.press("Enter");

  await expect(rows).toHaveCount(1);
  expect(urlParam(page, "species_search")).toBe("gen");

  await page.reload();
  await expect(species).toHaveValue("gen");
  await expect(rows).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("a Toggle on its reference page re-runs the query that reads it and keeps its state across a reload", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}/filters/toggle`);
  const males = page.getByRole("switch", { name: "Males only", exact: true });
  const adelie = resultTables(page).first().locator("tbody tr").first();
  // 152 Adelie penguins, 73 of them male.
  await expect(adelie).toContainText("152");

  await males.click();

  await expect(males).toHaveAttribute("aria-checked", "true");
  await expect(adelie).toContainText("73");
  expect(urlParam(page, "males_only")).toBe("true");

  await page.reload();
  await expect(males).toHaveAttribute("aria-checked", "true");
  await expect(adelie).toContainText("73");
  expect(errors).toEqual([]);
});

test("a Slider on its reference page pages by whole steps, so the query that reads it re-runs on each Page Up", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}/filters/slider`);
  const heavier = page.getByRole("slider", { name: "Heavier than (g)" });
  const adelie = resultTables(page)
    .filter({ hasText: "heavier" })
    .locator("tbody tr")
    .first();

  await heavier.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(heavier).toHaveAttribute("aria-valuenow", "2700");

  // 2500–6500 with a step of 100: a page is a tenth of the range, 400.
  await page.keyboard.press("PageUp");
  await expect(heavier).toHaveAttribute("aria-valuenow", "3100");
  // 136 of the 152 Adelie penguins weigh more than 3100 g.
  await expect(adelie).toContainText("136");
  expect(urlParam(page, "heavier_than")).toBe("3100");

  await page.keyboard.press("PageUp");
  await expect(heavier).toHaveAttribute("aria-valuenow", "3500");
  await expect(adelie).toContainText("92");
  expect(urlParam(page, "heavier_than")).toBe("3500");
  expect(errors).toEqual([]);
});

/** The result table rendered under the `name:` caption that echoes a query's name. */
function tableUnder(page: Page, name: string) {
  return page
    .locator("p", { hasText: new RegExp(`^${name}:$`) })
    .locator("xpath=following::table[1]");
}

test("an input's initialValue reaches the query that reads {{params.id}} on first paint, with no URL param", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);

  await page.goto(`${biacDev.url}/filters/toggle`);
  // 73 of the 152 Adelie penguins are female.
  await expect(
    tableUnder(page, "species_females").locator("tbody tr").first(),
  ).toContainText("73");

  await page.goto(`${biacDev.url}/filters/date-range`);
  await expect(tableUnder(page, "chosen_span_words")).toContainText(
    "last 7 days",
  );

  await page.goto(`${biacDev.url}/filters/text-input`);
  const islands = tableUnder(page, "islands_started").locator("tbody tr");
  await expect(islands).toHaveCount(1);
  await expect(islands).toContainText("Dream");

  expect(new URL(page.url()).search).toBe("");
  expect(errors).toEqual([]);
});

test("a FilterBar on its reference page docks to a Filters row on scroll and counts the pick made in it", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}/filters/filter-bar`);
  const bar = page.locator("main [data-filter-bar]").first();
  const trigger = bar.getByRole("button", { name: "Filters", exact: true });
  const rows = resultTables(page).first().locator("tbody tr");
  await expect(rows).toHaveCount(5);

  // Below the fold at rest, the bar still shows its inputs, not the row.
  await expect(trigger).toHaveCount(0);
  await expect(bar.getByRole("combobox", { name: "Island" })).toBeAttached();

  await page.locator("main h2", { hasText: "Props" }).scrollIntoViewIfNeeded();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await bar.getByRole("combobox", { name: "Island" }).click();
  await page.getByRole("option", { name: "Biscoe" }).click();

  await expect(trigger).toHaveAccessibleDescription("1 active");
  expect(urlParam(page, "bar_island")).toBe("Biscoe");
  await expect(rows).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("a shared link into the filters-and-URL page opens it narrowed, and clearing the pick drops the param", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}/filters/filters-and-urls?island=Dream`);
  const island = page.getByRole("combobox", { name: "Island" }).first();
  const rows = resultTables(page).first().locator("tbody tr");
  // Dream holds two of the five island × species pairs.
  await expect(island).toHaveText("Dream");
  await expect(rows).toHaveCount(2);

  await island.click();
  await page.getByRole("button", { name: "Clear" }).click();

  await expect(rows).toHaveCount(5);
  expect(urlParam(page, "island")).toBeNull();
  expect(errors).toEqual([]);
});
