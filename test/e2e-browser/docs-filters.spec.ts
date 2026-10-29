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
