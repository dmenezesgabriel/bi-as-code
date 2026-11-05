import type { Locator, Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

// The shipped example: every page but pages/nested/allocation.md names an
// icon, so the sidebar draws 8 of its 9 links with a glyph.
const LINK_NAMES = [
  "Orders overview",
  "Cross-filter at scale",
  "Orders dashboard",
  "Regional orders",
  "Weekly orders",
  "Weekly revenue (embed)",
  "Weekly review",
  "Region detail",
  "Allocation",
];

/** Opens `/weekly-review` and returns its site navigation once it has rendered. */
async function openWeeklyReviewNav(page: Page, url: string): Promise<Locator> {
  await page.goto(`${url}/weekly-review`);
  const nav = page.getByRole("navigation", { name: "Site navigation" });
  await expect(nav.getByRole("link", { name: "Weekly review" })).toBeVisible();
  return nav;
}

test("each page's front-matter icon shows, decorative, before its sidebar link's name", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const nav = await openWeeklyReviewNav(page, biacDev.url);
  const links = nav.locator("li a");

  expect((await links.allTextContents()).sort()).toEqual(
    [...LINK_NAMES].sort(),
  );
  await expect(links.locator("svg")).toHaveCount(8);
  await expect(links.locator('svg:not([aria-hidden="true"])')).toHaveCount(0);
  // Located by text, so an icon that leaked into the name would show here.
  await expect(links.filter({ hasText: "Weekly review" })).toHaveAccessibleName(
    "Weekly review",
  );
  await expect(
    nav.getByRole("link", { name: "Weekly review" }).locator("svg"),
  ).toHaveClass(/lucide-calendar/);
  await expect(
    links.filter({ hasText: "Allocation" }).locator("svg"),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("editing a page's front-matter icon redraws its sidebar link, and deleting it leaves the name alone", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const nav = await openWeeklyReviewNav(page, biacDev.url);
  const link = nav.getByRole("link", { name: "Weekly review" });
  const file = join(biacDev.projectDir, "pages/weekly-review.md");
  const original = readFileSync(file, "utf8");

  writeFileSync(file, original.replace("icon: calendar\n", "icon: clock\n"));
  await expect(link.locator("svg")).toHaveClass(/lucide-clock/, {
    timeout: 20_000,
  });

  writeFileSync(file, original.replace("icon: calendar\n", ""));
  await expect(link.locator("svg")).toHaveCount(0, { timeout: 20_000 });
  await expect(link).toBeVisible();

  writeFileSync(file, original);
  expect(errors).toEqual([]);
});

test("front-matter icon outside the catalog shows its error with the closest name, and a catalog name recovers the page", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}/weekly-review`);
  const heading = page.getByRole("heading", {
    level: 1,
    name: "Weekly review",
  });
  await expect(heading).toBeVisible();

  const file = join(biacDev.projectDir, "pages/weekly-review.md");
  const original = readFileSync(file, "utf8");
  const withIcon = (value: string) =>
    original.replace("icon: calendar\n", `icon: ${value}\n`);
  writeFileSync(file, withIcon("calender"));
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("front-matter in pages/weekly-review.md", {
    timeout: 20_000,
  });
  await expect(alert).toContainText(
    "icon: expected one of house, layout-dashboard,",
  );
  await expect(alert).toContainText('got "calender" (did you mean calendar?)');
  await expect(page.getByRole("link", { name: "Weekly review" })).toBeVisible();

  writeFileSync(file, withIcon("clock"));
  await expect(heading).toBeVisible({ timeout: 20_000 });
  await expect(alert).toHaveCount(0);

  writeFileSync(file, original);
  expect(errors).toEqual([]);
});
