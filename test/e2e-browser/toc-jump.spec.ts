import type { Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { openWeeklyReviewCharts } from "./echart-hosts.js";

// The clearance a jumped heading keeps under the header on a page with no
// bar (80px scroll margin − 48px header) — the same rhythm below a docked bar.
const GAP_BELOW_DOCKED_BAR_PX = 32;

const DESKTOP = { width: 1280, height: 720 };
const PHONE = { width: 375, height: 812 };
// Tall enough that a short section's successor also clears mid-viewport after
// a jump — where the center rule alone lights the wrong entry.
const TALL_DESKTOP = { width: 1280, height: 1400 };

/**
 * How far the heading's top sits below the filter bar's bottom edge, in px;
 * negative when the bar covers it, Infinity when the heading is wholly above
 * the bar (a section before the bar's rest position).
 */
function clearanceBelowBar(page: Page, headingId: string): Promise<number> {
  return page.evaluate((id) => {
    const heading = document.getElementById(id);
    const bar = document.querySelector("[data-filter-bar]");
    if (!heading || !bar) throw new Error(`no #${id} or filter bar`);
    const h = heading.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    if (h.bottom <= b.top) return Number.POSITIVE_INFINITY;
    return Math.round(h.top - b.bottom);
  }, headingId);
}

/** The ids of the page's h2/h3 headings, in document order. */
function headingIds(page: Page): Promise<string[]> {
  return page
    .locator("main :is(h2, h3)[id]")
    .evaluateAll((els) => els.map((el) => el.id));
}

/** Polls until the bar has settled (it docks on an IntersectionObserver). */
async function expectHeadingClearsBar(page: Page, id: string): Promise<void> {
  await expect
    .poll(() => clearanceBelowBar(page, id), { message: `#${id}` })
    .toBeGreaterThanOrEqual(GAP_BELOW_DOCKED_BAR_PX);
}

// crossfilter-scale names its rail in front-matter; weekly-review keeps the
// project default label.
for (const [route, tocLabel] of [
  ["weekly-review", "On this page"],
  ["crossfilter-scale", "Measures"],
] as const) {
  test(`every ToC entry on /${route} lands its heading below the docked filter bar`, async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.goto(`${biacDev.url}${route}`);
    const toc = page.getByRole("navigation", { name: tocLabel });
    await expect(toc).toBeVisible();

    for (const link of await toc.getByRole("link").all()) {
      const id = (await link.getAttribute("href"))!.slice(1);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expectHeadingClearsBar(page, id);
      await expect(toc.locator('[aria-current="location"]')).toHaveText(
        (await link.textContent())!,
      );
    }
    expect(errors).toEqual([]);
  });

  test(`on a phone every #heading link on /${route} lands below the docked filter bar`, async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize(PHONE);
    await page.goto(`${biacDev.url}${route}`);
    await expect(page.locator("[data-filter-bar]")).toBeVisible();

    // The rail hides at this width; the hash link is the jump a reader has.
    for (const id of await headingIds(page)) {
      await page.evaluate((hash) => (location.hash = hash), id);
      await expectHeadingClearsBar(page, id);
    }
    expect(errors).toEqual([]);
  });
}

test("on a tall viewport the rail lights the entry jumped to, not the short section after it", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize(TALL_DESKTOP);
  // Charts grow the page as they paint; jumping before then moves the
  // heading after it lands.
  await openWeeklyReviewCharts(page, biacDev.url);
  const toc = page.getByRole("navigation", { name: "On this page" });
  await expect(toc).toBeVisible();

  // Takeaways ends the page and cannot reach its landing offset: the jump
  // scrolls too little for any heading to cross mid-viewport.
  for (const name of ["Order mix", "Quarter detail", "Takeaways"]) {
    await toc.getByRole("link", { name, exact: true }).click();
    await expect(toc.locator('[aria-current="location"]')).toHaveText(name);
  }
  expect(errors).toEqual([]);
});

test("in the editor's preview pane a #heading link lands below the bar docked at the pane top", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize(DESKTOP);
  await page.goto(`${biacDev.url}weekly-review?edit`);
  await expect(
    page.getByRole("region", { name: "Live preview", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-filter-bar]")).toBeVisible();

  for (const id of ["regional-split", "order-mix", "takeaways"]) {
    await page.evaluate((hash) => (location.hash = hash), id);
    await expectHeadingClearsBar(page, id);
  }
  expect(errors).toEqual([]);
});
