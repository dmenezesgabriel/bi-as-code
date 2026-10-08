import type { Locator, Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expect,
  openOrderMixRow,
  resultTables,
  test,
  type BiacDev,
} from "./dev-server.fixture.js";

/** `page.url()` keeps percent-encoding; searchParams decodes it. */
function urlParam(page: { url(): string }, name: string): string | null {
  return new URL(page.url()).searchParams.get(name);
}

/**
 * Opens weekly-review and picks `name` in the Region dropdown — the
 * "reader picks a region" prologue shared by both dropdown tests. The
 * first assert waits out the option query behind the disabled trigger.
 */
async function pickRegion(
  page: Page,
  biacDev: BiacDev,
  name: string,
): Promise<Locator> {
  await page.goto(`${biacDev.url}weekly-review`);
  const region = page.getByRole("combobox", { name: "Region" });
  await expect(region).toHaveText("Select Region", { timeout: 30_000 });
  await region.click();
  await page.getByRole("option", { name }).click();
  expect(urlParam(page, "region")).toBe(name);
  return region;
}

/**
 * The input widgets' slice demo as tests: every interaction is a real
 * click/keystroke on the rendered widget — the URL is asserted as an
 * outcome, never seeded. weekly-review's Region dropdown and
 * nested/allocation's Channel multi-select write the `region`/`channel`
 * page filters; widgets declaring `filters` re-query; reloads read the
 * param back at filter construction.
 */
test("picking West in the Region dropdown filters weekly-review and survives reload", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  const region = await pickRegion(page, biacDev, "West");
  await expect(region).toHaveText("West");

  // The filter-declaring widgets re-query: the Order-mix <Table> narrows
  // to West's 13 weeks, first row week 1 at 4 orders / 175 revenue.
  expect(await openOrderMixRow(page, "Page 1 of 2 · 13 rows")).toEqual([
    "1",
    "West",
    "4",
    "175",
  ]);

  await page.reload();
  await expect(region).toHaveText("West", { timeout: 30_000 });
  expect(await openOrderMixRow(page, "Page 1 of 2 · 13 rows")).toEqual([
    "1",
    "West",
    "4",
    "175",
  ]);
  expect(errors).toEqual([]);
});

test("the Region dropdown's search narrows options and Clear drops the param", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  const region = await pickRegion(page, biacDev, "West");

  // Typing `no` narrows the option list to North alone — the popup's
  // search input is itself an ARIA combobox labelled "Search".
  await region.click();
  await page.getByRole("combobox", { name: "Search" }).fill("no");
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option", { name: "North" })).toBeVisible();

  // Clear removes the param; the full-quarter read returns.
  await page.getByRole("button", { name: "Clear" }).click();
  expect(urlParam(page, "region")).toBeNull();
  await expect(region).toHaveText("Select Region");
  expect(await openOrderMixRow(page, "Page 1 of 4 · 39 rows")).toEqual([
    "1",
    "North",
    "14",
    "560",
  ]);
  expect(errors).toEqual([]);
});

test("picking channels in the multi-select chips the field, filters the table and survives reload", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}nested/allocation`);

  const channel = page.getByRole("combobox", { name: "Channel" });
  await expect(channel).toBeEnabled({ timeout: 30_000 });
  await channel.click();

  // The popup stays open across picks; both options land as chips.
  await page.getByRole("option", { name: "Direct" }).click();
  await page.getByRole("option", { name: "Marketplace" }).click();
  expect(urlParam(page, "channel")).toBe('["Direct","Marketplace"]');

  // Base UI's focus sweep aria-hides pre-existing chips while the popup
  // is open — dismiss before asserting them, the reader's real flow.
  // Escape must land on the field input: a document-level press can fall
  // between the popup's focus targets while the pick re-renders.
  await channel.press("Escape");
  await expect(
    page.getByRole("button", { name: "Remove Direct" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Marketplace" }),
  ).toBeVisible();

  // The fence's own preview keeps all three channels; the <Table>
  // declaring `filters="channel"` narrows to the two picked rows.
  const results = resultTables(page);
  await expect(results.nth(0).getByRole("row")).toHaveCount(4);
  await expect(results.nth(1).getByRole("row")).toHaveCount(3);
  await expect(results.nth(1)).toContainText("Direct");
  await expect(results.nth(1)).toContainText("Marketplace");
  await expect(results.nth(1)).not.toContainText("Partner");

  await page.reload();
  await expect(page.getByRole("button", { name: "Remove Direct" })).toBeVisible(
    { timeout: 30_000 },
  );
  await expect(
    page.getByRole("button", { name: "Remove Marketplace" }),
  ).toBeVisible();
  await expect(resultTables(page).nth(1).getByRole("row")).toHaveCount(3);
  expect(urlParam(page, "channel")).toBe('["Direct","Marketplace"]');
  expect(errors).toEqual([]);
});
