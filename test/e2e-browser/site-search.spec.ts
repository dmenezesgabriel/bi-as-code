import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

test("the sidebar search box finds pages by body word, ranks titles first, and opens a result with the keyboard", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(biacDev.url);
  const nav = page.getByRole("navigation", { name: "Site navigation" });
  const box = nav.getByRole("combobox", { name: "Search pages" });
  const results = nav.getByRole("option");

  await box.fill("fulfilment");
  await expect(results).toHaveText(["Allocation"]);
  await expect(results.first()).toHaveAttribute("href", "/nested/allocation");

  await box.fill("");
  await expect(results).toHaveCount(0);

  await box.fill("weekly");
  await expect(results.first()).toHaveText("Weekly orders");
  await expect(results.nth(1)).toHaveText("Weekly review");
  await box.press("ArrowDown");
  await expect(results.nth(1)).toHaveAttribute("data-highlighted", "");
  await box.press("Enter");

  await expect(page).toHaveURL(/\/weekly-review$/);
  await expect(box).toHaveValue("");
  expect(errors).toEqual([]);
});
