import type { Locator, Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

/**
 * The Overview KPI `<Row>` — the only `flex-wrap` container holding the
 * "Quarter revenue" BigValue (exact match: the Takeaways Note reads
 * "quarter revenue, all regions").
 */
function kpiRow(page: Page) {
  return page
    .locator("div.flex.flex-wrap")
    .filter({ has: page.getByText("Quarter revenue", { exact: true }) });
}

interface Box {
  top: number;
  width: number;
}

/** Top and width of the KPI row's three children, read in one layout pass. */
async function childBoxes(row: Locator): Promise<[Box, Box, Box]> {
  const boxes = await row.locator("> *").evaluateAll((els) =>
    els.map((el) => {
      const box = el.getBoundingClientRect();
      return { top: box.top, width: box.width };
    }),
  );
  if (boxes.length !== 3) {
    throw new Error(`expected 3 row children, found ${boxes.length}`);
  }
  return boxes as [Box, Box, Box];
}

test("the page renders the three callout variants with their type tints", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  // Document order: Reading guide (info), Concentration risk (warning),
  // Clean lift (success) — each carries its palette as classes.
  const notes = page.getByRole("note");
  await expect(notes).toHaveCount(3, { timeout: 30_000 });
  await expect(notes.nth(0)).toHaveClass(/bg-blue-50/);
  await expect(notes.nth(0)).toContainText("Reading guide");
  await expect(notes.nth(1)).toHaveClass(/bg-yellow-50/);
  await expect(notes.nth(1)).toContainText("Concentration risk");
  await expect(notes.nth(2)).toHaveClass(/bg-emerald-50/);
  await expect(notes.nth(2)).toContainText("Clean lift");
  expect(errors).toEqual([]);
});

test("<Details> toggles aria-expanded and reveals its panel", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const trigger = page.getByRole("button", { name: "Metric definitions" });
  await expect(trigger).toHaveAttribute("aria-expanded", "false", {
    timeout: 30_000,
  });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("count of booked orders")).toBeVisible();

  // The `open` details starts expanded without a click.
  await expect(
    page.getByRole("button", { name: "How the region filter works" }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(errors).toEqual([]);
});

test("<Details openMobile> resolves against the viewport only at mount", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${biacDev.url}weekly-review`);

  const trigger = page.getByRole("button", { name: "Mobile summary" });
  await expect(trigger).toHaveAttribute("aria-expanded", "false", {
    timeout: 30_000,
  });

  // Resizing past the breakpoint after mount never flips the reader's
  // disclosure — only a fresh load below `md` starts the panel open.
  await page.setViewportSize({ width: 500, height: 720 });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(trigger).toHaveAttribute("aria-expanded", "true", {
    timeout: 30_000,
  });
  expect(errors).toEqual([]);
});

test("the order-mix tablist switches panels by click and arrow keys", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const chartTab = page.getByRole("tab", { name: "Chart" });
  const tableTab = page.getByRole("tab", { name: "Table" });
  await expect(chartTab).toHaveAttribute("aria-selected", "true", {
    timeout: 30_000,
  });

  await tableTab.click();
  await expect(tableTab).toHaveAttribute("aria-selected", "true");
  await expect(chartTab).toHaveAttribute("aria-selected", "false");
  const visiblePanel = page.locator('[role="tabpanel"]:not([hidden])');
  await expect(visiblePanel.locator("table tbody tr").first()).toBeVisible({
    timeout: 30_000,
  });

  // Panels stay mounted: the hidden Chart panel keeps its echarts host.
  await expect(
    page.locator('[role="tabpanel"][hidden] [data-echarts-theme]'),
  ).toHaveCount(1);

  // Roving focus with activateOnFocus: ArrowRight wraps Chart→Table,
  // ArrowLeft steps back.
  await page.keyboard.press("ArrowRight");
  await expect(chartTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(tableTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(chartTab).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

test("the single accordion closes the open item; the multi accordion keeps both", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const methodology = page.getByRole("button", { name: "Methodology" });
  const quality = page.getByRole("button", { name: "Data quality" });
  await expect(methodology).toHaveAttribute("aria-expanded", "false", {
    timeout: 30_000,
  });
  await expect(quality).toHaveAttribute("aria-expanded", "false");

  await quality.click();
  await expect(quality).toHaveAttribute("aria-expanded", "true");
  await methodology.click();
  await expect(methodology).toHaveAttribute("aria-expanded", "true");
  await expect(quality).toHaveAttribute("aria-expanded", "false");

  // No `single` on the second accordion — both items stay open.
  const changeLog = page.getByRole("button", { name: "Change log" });
  const sources = page.getByRole("button", { name: "Sources" });
  await changeLog.click();
  await sources.click();
  await expect(changeLog).toHaveAttribute("aria-expanded", "true");
  await expect(sources).toHaveAttribute("aria-expanded", "true");
  expect(errors).toEqual([]);
});

test("the KPI row shares thirds at 1280px and wraps to full-width lines at 500px", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${biacDev.url}weekly-review`);

  const row = kpiRow(page);
  await expect(row.locator("> *")).toHaveCount(3, { timeout: 30_000 });

  // Wide: one line, equal thirds.
  const wide = await childBoxes(row);
  expect(Math.abs(wide[1].top - wide[0].top)).toBeLessThan(2);
  expect(Math.abs(wide[2].top - wide[0].top)).toBeLessThan(2);
  expect(Math.abs(wide[0].width - wide[1].width)).toBeLessThan(2);
  expect(wide[0].width).toBeGreaterThan(200);

  // Narrow: each cell wraps onto its own full-width line.
  await page.setViewportSize({ width: 500, height: 720 });
  const narrow = await childBoxes(row);
  expect(narrow[1].top).toBeGreaterThan(narrow[0].top + 50);
  expect(narrow[2].top).toBeGreaterThan(narrow[1].top + 50);
  expect(narrow[0].width).toBeGreaterThan(narrow[1].width - 2);
  expect(narrow[0].width).toBeLessThan(480);

  // The slice's widgets never force the page wide: the Row's cells stack
  // inside its own box, and the tablist scrolls within its own wrapper.
  // (The page-level scrollWidth is owned by the shiki fences, which
  // overflow at phone width — pre-existing, tracked for the usability
  // audit.)
  const rowOverflow = await row.evaluate(
    (el) => el.scrollWidth - el.clientWidth,
  );
  expect(rowOverflow).toBeLessThanOrEqual(0);
  const tablistWrapper = page
    .locator("div.overflow-x-auto")
    .filter({ has: page.getByRole("tablist") });
  const tablistOverflow = await tablistWrapper.evaluate(
    (el) => el.scrollWidth - el.clientWidth,
  );
  expect(tablistOverflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
