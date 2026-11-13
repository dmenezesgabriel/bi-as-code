import type { Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

// `--spacing-block-gap` in `src/web/src/styles.css`.
const BLOCK_GAP_PX = 16;

/**
 * Every visual gap between consecutive boxed children of `main` that breaks
 * the page rhythm, as `"prev → next: gap"` lines: a gap touching a heading
 * must sit on the 4 px grid, every other gap must be one block gap. The gap
 * is measured box to box, so collapsed margins count once. Zero-height and
 * `aria-hidden` children (the filter bar's sentinel and spacer) are layout
 * aids, not blocks; a gap beside a `<br>` is space the author asked for.
 */
function offRhythmGaps(page: Page): Promise<string[]> {
  return page.evaluate((blockGap) => {
    const blocks = [...document.querySelectorAll("main > *")].filter(
      (el) =>
        el.getAttribute("aria-hidden") !== "true" &&
        el.getBoundingClientRect().height > 0,
    );
    const label = (el: Element) =>
      el.tagName === "DIV" ? `div.${el.className.split(" ")[0]}` : el.tagName;
    const isHeading = (el: Element) => /^H[1-6]$/.test(el.tagName);
    const isBreak = (el: Element) => el.tagName === "BR";
    const offGaps: string[] = [];
    blocks.reduce((prev, next) => {
      const gap =
        next.getBoundingClientRect().top - prev.getBoundingClientRect().bottom;
      const rounded = Math.round(gap * 100) / 100;
      const ok =
        isBreak(prev) ||
        isBreak(next) ||
        (isHeading(prev) || isHeading(next)
          ? rounded > 0 && rounded % 4 === 0
          : Math.abs(gap - blockGap) < 0.5);
      if (!ok) offGaps.push(`${label(prev)} → ${label(next)}: ${rounded}`);
      return next;
    });
    return offGaps;
  }, BLOCK_GAP_PX);
}

for (const route of ["weekly-review", "", "crossfilter-scale"]) {
  test(`/${route} keeps one block gap between consecutive blocks`, async ({
    page,
    biacDev,
  }) => {
    // Arrange
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    // Act
    await page.goto(`${biacDev.url}${route}`);
    await expect(page.locator("main > h1")).toBeVisible();

    // Assert — polled: widgets settle their height as their queries land.
    await expect.poll(() => offRhythmGaps(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

// `--container-measure` in `src/web/src/styles.css`: 70ch at the 16 px body.
const MEASURE_PX = 640;
const WCAG_LINE_CH = 80;

/** The first `main > p`'s width in `ch` of its own font. */
function paragraphWidthInCh(page: Page): Promise<number> {
  return page.evaluate(() => {
    const paragraph = document.querySelector("main > p");
    if (!paragraph) throw new Error("expected a `main > p`, found none");
    const ch = document.createElement("span");
    ch.style.cssText = "display:inline-block;width:1ch";
    paragraph.append(ch);
    const width = paragraph.getBoundingClientRect().width;
    const chWidth = ch.getBoundingClientRect().width;
    ch.remove();
    return width / chWidth;
  });
}

/** The page column's width and the width of the block holding its first chart. */
function chartAndColumnWidths(page: Page): Promise<[number, number]> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const chart = [...(main?.children ?? [])].find((block) =>
      block.querySelector("[data-echarts-ready]"),
    );
    if (!main || !chart) throw new Error("expected a chart block in `main`");
    return [
      chart.getBoundingClientRect().width,
      main.getBoundingClientRect().width,
    ];
  });
}

for (const [route, width] of [
  ["", 1920],
  ["weekly-review", 1280],
] as const) {
  test(`/${route} at ${width}px stops prose at the measure and keeps charts the full column`, async ({
    page,
    biacDev,
  }) => {
    // Arrange
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width, height: 900 });

    // Act
    await page.goto(`${biacDev.url}${route}`);
    await expect(page.locator("[data-echarts-ready]").first()).toBeVisible();

    // Assert — the measure is 640 px; its width in `ch` follows the font
    // (70 in Noto Sans, 72 in Arial), so `ch` is held to WCAG 2.1 SC 1.4.8's
    // 80-character line, https://www.w3.org/TR/WCAG21/#visual-presentation.
    const paragraph = await page.locator("main > p").first().boundingBox();
    expect(paragraph?.width).toBeLessThanOrEqual(MEASURE_PX);
    expect(await paragraphWidthInCh(page)).toBeLessThanOrEqual(WCAG_LINE_CH);
    const [chartWidth, columnWidth] = await chartAndColumnWidths(page);
    expect(columnWidth).toBeGreaterThan(MEASURE_PX);
    expect(chartWidth).toBeCloseTo(columnWidth, 0);
    expect(errors).toEqual([]);
  });
}

test("/weekly-review caps a markdown list at the measure", async ({
  page,
  biacDev,
}) => {
  // Arrange
  await page.setViewportSize({ width: 1920, height: 900 });

  // Act
  await page.goto(`${biacDev.url}weekly-review`);

  // Assert
  const list = page.locator("main > ul").first();
  await expect(list).toBeVisible();
  const box = await list.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(MEASURE_PX);
});
