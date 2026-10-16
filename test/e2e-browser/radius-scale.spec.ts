import type { Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { chartHosts, openWeeklyReviewCharts } from "./echart-hosts.js";

/** `rounded-full` is `calc(infinity * 1px)`, which chromium paints as this. */
const PILL = "3.35544e+07px";

/**
 * The scale steps in use, as utilities: `@theme inline` compiles each
 * `--radius-*` step into its utility rather than into a variable, so the
 * steps are measured by painting them.
 */
const SCALE_UTILITIES = ["rounded-sm", "rounded-md", "rounded-lg"];

/** Resolves each scale utility to px on a probe element, plus the pill. */
async function scaleRadii(page: Page): Promise<string[]> {
  const steps = await page.evaluate((utilities) => {
    const probe = document.body.appendChild(document.createElement("div"));
    const resolved = utilities.map((utility) => {
      probe.className = utility;
      return getComputedStyle(probe).borderTopLeftRadius;
    });
    probe.remove();
    return resolved;
  }, SCALE_UTILITIES);
  return [...steps, PILL];
}

/** Every distinct non-zero corner radius painted on the page. */
async function paintedRadii(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const corners = [
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
    ] as const;
    const radii = new Set<string>();
    for (const element of document.querySelectorAll("*")) {
      const style = getComputedStyle(element);
      for (const corner of corners) radii.add(style[corner]);
    }
    radii.delete("0px");
    return [...radii].sort();
  });
}

/** Asserts the scale resolves to `expected` and every painted corner sits on it. */
async function expectCornersOnScale(
  page: Page,
  expected: string[],
): Promise<void> {
  const scale = await scaleRadii(page);
  expect(scale).toEqual(expected);
  for (const radius of await paintedRadii(page)) {
    expect(scale, `painted radius ${radius}`).toContain(radius);
  }
}

async function openWeeklyReview(page: Page, url: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${url}weekly-review`);
  await expect(page.getByRole("combobox", { name: "Region" })).toBeVisible();
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test("every corner is a step of the radius scale", async ({
      page,
      biacDev,
    }) => {
      const errors = collectConsoleErrors(page);
      await openWeeklyReview(page, biacDev.url);
      await expectCornersOnScale(page, ["4px", "6px", "8px", PILL]);
      expect(errors).toEqual([]);
    });

    test("every corner follows a changed --radius", async ({
      page,
      biacDev,
    }) => {
      await openWeeklyReview(page, biacDev.url);
      await page.evaluate(() =>
        document.documentElement.style.setProperty("--radius", "0.75rem"),
      );
      await expectCornersOnScale(page, ["8px", "10px", "12px", PILL]);
    });

    test("an open chart tooltip's corner follows a changed --radius", async ({
      page,
      biacDev,
    }) => {
      const errors = collectConsoleErrors(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await openWeeklyReviewCharts(page, biacDev.url);
      await page.evaluate(() =>
        document.documentElement.style.setProperty("--radius", "0.75rem"),
      );
      const bars = chartHosts(page).first();
      await bars.scrollIntoViewIfNeeded();

      await bars.hover();

      // The html tooltip is the host's only child whose inline style sets
      // the engine's tooltip z-index.
      const tooltip = bars.locator('div[style*="z-index: 9999999"]');
      await expect(tooltip).toBeVisible();
      const [smallest] = await scaleRadii(page);
      await expect(tooltip).toHaveCSS("border-top-left-radius", smallest!);
      expect(errors).toEqual([]);
    });
  });
}
