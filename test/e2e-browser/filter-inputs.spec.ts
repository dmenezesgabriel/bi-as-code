import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expect,
  openOrderMixRow,
  resultTables,
  sliderThumbBox,
  test,
  urlParam,
  type BiacDev,
} from "./dev-server.fixture.js";

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
  await expect(region).toHaveText("Select Region");
  // Disabled until its options load. A click that has to wait retries with
  // a different scroll alignment each time, and one that lands the bar on
  // its dock line collapses it and hides the dropdown being clicked.
  await expect(region).toBeEnabled();
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

  // The reload restores the scroll position at the Order-mix table, so the
  // bar comes back docked and Region sits behind its `Filters` row.
  await page.reload();
  await page
    .getByRole("button", { name: "Filters", exact: true })
    .click({ timeout: 30_000 });
  await expect(region).toHaveText("West");
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
  await expect(channel).toBeEnabled();
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

  // The <Table> declaring `filters="channel"` narrows to the two picked
  // rows; its fence opts into no `display`, so it is the page's one table.
  const results = resultTables(page);
  await expect(results).toHaveCount(1);
  await expect(results.nth(0).getByRole("row")).toHaveCount(3);
  await expect(results.nth(0)).toContainText("Direct");
  await expect(results.nth(0)).toContainText("Marketplace");
  await expect(results.nth(0)).not.toContainText("Partner");

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove Direct" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Marketplace" }),
  ).toBeVisible();
  await expect(resultTables(page).nth(0).getByRole("row")).toHaveCount(3);
  expect(urlParam(page, "channel")).toBe('["Direct","Marketplace"]');
  expect(errors).toEqual([]);
});

/**
 * The live table over `order_detail` — the `<Table>` widget, its fence
 * opting into no `display`. Both `{{params.*}}` interpolations and
 * `filters` predicates reach it. The widget root — the scroll container's
 * parent — is what carries the pager.
 */
function orderDetailTable(page: Page): Locator {
  return page
    .locator("div.overflow-x-auto", {
      has: page.getByRole("columnheader", { name: "Order ID" }),
    })
    .locator("..");
}

/**
 * The `order_date` column of the shipped fixture, read back rather than
 * hardcoded: the generator anchors the quarter to the regen week, so
 * absolute-range assertions derive their window from the data itself.
 */
function readOrderDates(projectDir: string): string[] {
  const csv = readFileSync(join(projectDir, "data/orders.csv"), "utf8");
  const lines = csv.trim().split("\n");
  const column = lines[0]!.split(",").indexOf("order_date");
  return lines.slice(1).map((line) => line.split(",")[column]!);
}

/** Local-date ISO arithmetic — the same form `type="date"` fields hold. */
function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

test("the Amount slider writes a range param and narrows order_detail", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  // Bounds derive from order_amounts (38..44); the seed sits at both ends.
  const minimum = page.getByRole("slider", { name: "Minimum" });
  await expect(minimum).toBeEnabled();
  await expect(minimum).toHaveAttribute("aria-valuenow", "38");

  await minimum.press("ArrowRight");
  expect(urlParam(page, "amount")).toBe("39 - 44");
  // 39..44 keeps South's 39s, all North 40s and all West — 350 of 355.
  const table = orderDetailTable(page);
  await expect(table).toContainText("· 350 rows");

  await page.reload();
  await expect(page.getByRole("slider", { name: "Minimum" })).toHaveAttribute(
    "aria-valuenow",
    "39",
  );
  expect(urlParam(page, "amount")).toBe("39 - 44");
  expect(errors).toEqual([]);
});

test("a region holding one amount states it as text, and another region brings the slider back", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  const boundsWarnings: string[] = [];
  page.on("console", (message) => {
    if (/max. must be greater than .min./.test(message.text())) {
      boundsWarnings.push(message.text());
    }
  });
  await page.goto(`${biacDev.url}weekly-review?region=North`);

  // Every North order is $40, so the Amount bounds collapse to one value.
  await expect(page.getByText("only one value in range")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Minimum" })).toHaveCount(0);

  const region = page.getByRole("combobox", { name: "Region" });
  await expect(region).toBeEnabled();
  await region.click();
  await page.getByRole("option", { name: "West" }).click();

  await expect(page.getByRole("slider", { name: "Minimum" })).toBeEnabled();
  await expect(page.getByRole("slider", { name: "Maximum" })).toBeEnabled();
  await expect(page.getByText("only one value in range")).toHaveCount(0);
  expect(boundsWarnings).toEqual([]);
  expect(errors).toEqual([]);
});

test("a pointer drag keeps moving the Amount slider past its first step", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);
  const maximum = page.getByRole("slider", { name: "Maximum" });
  await expect(maximum).toBeEnabled();
  const from = await sliderThumbBox(page, "Maximum");
  const to = await sliderThumbBox(page, "Minimum");
  const y = from.y + from.height / 2;

  // Each step publishes the amount clause and rewrites the URL; a page
  // re-run that disabled the slider mid-drag would end the gesture at the
  // first step (44 → 43), so every later step must move the thumb again.
  await page.mouse.move(from.x + from.width / 2, y);
  await page.mouse.down();
  let held = 44;
  for (const k of [0.2, 0.4, 0.6, 0.8]) {
    await page.mouse.move(from.x + (to.x - from.x) * k, y);
    await expect
      .poll(async () => Number(await maximum.getAttribute("aria-valuenow")))
      .toBeLessThan(held);
    held = Number(await maximum.getAttribute("aria-valuenow"));
  }
  await page.mouse.up();

  await expect(maximum).toHaveAttribute("aria-valuenow", "39");
  expect(urlParam(page, "amount")).toBe("38 - 39");
  expect(errors).toEqual([]);
});

test("the Region dropdown cross-filters on amount but never on its own pick", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  const region = await pickRegion(page, biacDev, "West");

  // The publishing input's own clause skips its own options query —
  // reopening the dropdown still lists every region.
  await region.click();
  await expect(page.getByRole("option")).toHaveCount(3);
  await page.getByRole("button", { name: "Clear" }).click();
  await expect.poll(() => urlParam(page, "region")).toBeNull();

  // The slider's amount clause does reach the dropdown's options query
  // (`filters={["region","amount"]}` on order_amounts): pinning the range
  // to West's 43..44 band leaves West alone in the list. Reload first —
  // the cascade-collapsed bounds hold the thumb at 43 silently; a fresh
  // page re-seeds it to the full extent, so five ArrowRight steps land 43.
  await page.reload();
  const minimum = page.getByRole("slider", { name: "Minimum" });
  await expect(minimum).toBeEnabled();
  // Each step republishes the clause and re-renders the thumb — poll-press
  // rather than firing five blind presses, so a mid-render keypress can't
  // drop.
  await expect
    .poll(async () => {
      const now = Number(await minimum.getAttribute("aria-valuenow"));
      if (now < 43) await minimum.press("ArrowRight");
      if (now > 43) await minimum.press("ArrowLeft");
      return urlParam(page, "amount");
    })
    .toBe("43 - 44");

  await region.click();
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option", { name: "West" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the Ordered date range persists the expression and narrows order_detail", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  // A preset writes its rolling expression; the reload re-rolls the window
  // rather than pinning dates, so only the param, the label and the widget
  // narrowing (any delta from the raw 355) assert here.
  await page.locator("#ordered").click();
  await page.getByRole("button", { name: "Last 30 Days" }).click();
  await expect.poll(() => urlParam(page, "ordered")).toBe("last 30 days");
  const table = orderDetailTable(page);
  await expect(table).not.toContainText("· 355 rows");

  await page.reload();
  await expect(page.locator("#ordered")).toContainText("Last 30 Days");
  expect(urlParam(page, "ordered")).toBe("last 30 days");

  // An absolute range over the fixture's own dates narrows the table —
  // derived from the CSV so the assert never depends on fixture freshness.
  const dates = readOrderDates(biacDev.projectDir);
  const end = dates.reduce((a, b) => (a > b ? a : b));
  const start = addDaysIso(end, -27);
  const expected = dates.filter((d) => d >= start && d <= end).length;

  await page.locator("#ordered").click();
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("End date").fill(end);
  await expect.poll(() => urlParam(page, "ordered")).toBe(`${start} to ${end}`);
  await expect(table).toContainText(`· ${expected} rows`);
  expect(errors).toEqual([]);
});

test("the q search narrows order_detail through filters, counts its matches and persists", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);
  const table = orderDetailTable(page);
  // The count beside the box reads the same order_detail rows the table
  // shows, under the same filters plus the search itself.
  const count = page.getByRole("status").filter({ hasText: /match/ });
  await expect(table).toContainText("· 355 rows");
  await expect(count).toHaveText("355 matches");

  const q = page.getByRole("searchbox", { name: "Search regions" });
  await expect(q).toBeEnabled();
  await q.fill("we");
  // The commit lands after ~300ms of quiet — poll past the debounce. The
  // match clause reaches the table through its `filters`, no fence SQL.
  await expect.poll(() => urlParam(page, "q")).toBe("we");
  await expect(table).toContainText("· 140 rows");
  await expect(count).toHaveText("140 matches");

  await q.fill("zzz");
  await expect.poll(() => urlParam(page, "q")).toBe("zzz");
  await expect(count).toHaveText("No matches");

  await q.fill("we");
  await expect.poll(() => urlParam(page, "q")).toBe("we");
  await page.reload();
  await expect(
    page.getByRole("searchbox", { name: "Search regions" }),
  ).toHaveValue("we");
  await expect(table).toContainText("· 140 rows");
  await expect(count).toHaveText("140 matches");

  await page.getByRole("searchbox", { name: "Search regions" }).fill("");
  await expect.poll(() => urlParam(page, "q")).toBeNull();
  await expect(table).toContainText("· 355 rows");
  await expect(count).toHaveText("355 matches");
  expect(errors).toEqual([]);
});

test("the order text input and large_orders toggle re-query order_detail", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const order = page.getByLabel("Order id");
  await expect(order).toBeEnabled();
  await order.fill("42");
  // The `{{params.order}}` interpolation narrows the fence the table reads.
  await expect.poll(() => urlParam(page, "order")).toBe("42");
  const table = orderDetailTable(page);
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("South");

  // The label activates the switch's hidden checkbox natively.
  await page.locator("label[for='large_orders-face']").click();
  await expect.poll(() => urlParam(page, "large_orders")).toBe("true");
  // Order 42 is a 39-dollar order — below the large-orders bar of 44.
  await expect(page.getByText("0 rows", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Order id")).toHaveValue("42");
  // The label names both the switch face and its hidden checkbox input —
  // the role locator pins the one carrying the checked face.
  await expect(
    page.getByRole("switch", { name: "Large orders only" }),
  ).toBeChecked();
  await expect(page.getByText("0 rows", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the Channel button group picks Direct, syncs the multi-select and persists", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}nested/allocation`);

  const direct = page
    .getByRole("group", { name: "Channel" })
    .getByRole("button", { name: "Direct" });
  await expect(direct).toBeEnabled();
  await direct.click();

  // The ButtonGroup is `multiple` — the shared channel filter serializes a
  // lone pick as the JSON list, so both inputs keep one canonical shape.
  await expect.poll(() => urlParam(page, "channel")).toBe('["Direct"]');
  await expect(
    page.getByRole("button", { name: "Remove Direct" }),
  ).toBeVisible();

  const results = resultTables(page);
  await expect(results.nth(0).getByRole("row")).toHaveCount(2);
  await expect(results.nth(0)).toContainText("Direct");
  await expect(results.nth(0)).not.toContainText("Partner");

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove Direct" }),
  ).toBeVisible();
  await expect(direct).toHaveAttribute("aria-pressed", "true");
  await expect(resultTables(page).nth(0).getByRole("row")).toHaveCount(2);
  expect(errors).toEqual([]);
});
