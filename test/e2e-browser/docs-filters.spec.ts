import {
  collectConsoleErrors,
  expect,
  resultTables,
  test,
  urlParam,
} from "./dev-server.fixture.js";

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
