import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

test.use({ biacProject: "docs", viewport: { width: 375, height: 812 } });

const ROUTE = "/pages/markdown-pages";
const TITLE = "Markdown pages and front-matter";

test("the Markdown pages reference sits in the Pages sidebar group, titles the tab and its breadcrumb, and fits 375 px", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}${ROUTE}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  await expect(page).toHaveTitle(TITLE);
  const crumbs = page.getByRole("navigation", { name: "breadcrumb" });
  await expect(crumbs).toHaveText(
    new RegExp(`What is biac\\s*/\\s*Pages\\s*/\\s*${TITLE}`),
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});

test("the sidebar lists the page under a Pages group", async ({
  page,
  biacDev,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${biacDev.url}${ROUTE}`);

  const nav = page.getByRole("navigation", { name: "Site navigation" });
  const group = nav.locator("details", { hasText: "Pages" }).first();
  await expect(group.getByRole("link", { name: TITLE })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("the table of contents lists every section of the page", async ({
  page,
  biacDev,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${biacDev.url}${ROUTE}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  const toc = page.getByRole("navigation", { name: "On this page" });
  const sections = await page.locator("main h2").allTextContents();
  expect(sections.length).toBeGreaterThanOrEqual(3);
  for (const section of sections) {
    await expect(toc.getByRole("link", { name: section })).toBeVisible();
  }
});
