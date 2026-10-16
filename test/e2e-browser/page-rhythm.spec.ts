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
