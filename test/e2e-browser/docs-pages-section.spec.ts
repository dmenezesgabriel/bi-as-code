import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

test.use({ biacProject: "docs", viewport: { width: 375, height: 812 } });

const PAGES = [
  { route: "/pages/markdown-pages", title: "Markdown pages and front-matter" },
  { route: "/pages/biac-config", title: "biac.config.ts" },
  {
    route: "/pages/sidebar-contents-breadcrumbs",
    title: "Sidebar, table of contents and breadcrumbs",
  },
];

for (const { route, title } of PAGES) {
  test.describe(`the ${title} reference`, () => {
    test("sits in the Pages sidebar group, titles the tab and its breadcrumb, and fits 375 px", async ({
      page,
      biacDev,
    }) => {
      const errors = collectConsoleErrors(page);
      await page.goto(`${biacDev.url}${route}`);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page).toHaveTitle(title);
      const crumbs = page.getByRole("navigation", { name: "breadcrumb" });
      await expect(crumbs).toHaveText(
        new RegExp(`What is biac\\s*/\\s*Pages\\s*/\\s*${escapeRegExp(title)}`),
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBe(0);
      expect(errors).toEqual([]);
    });

    test("is listed in the sidebar under a Pages group", async ({
      page,
      biacDev,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`${biacDev.url}${route}`);

      const nav = page.getByRole("navigation", { name: "Site navigation" });
      const group = nav.locator("details", { hasText: "Pages" }).first();
      await expect(group.getByRole("link", { name: title })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    test("has a table of contents that lists every section", async ({
      page,
      biacDev,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`${biacDev.url}${route}`);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      const toc = page.getByRole("navigation", { name: "On this page" });
      const sections = await page.locator("main h2").allTextContents();
      expect(sections.length).toBeGreaterThanOrEqual(3);
      for (const section of sections) {
        await expect(
          toc.getByRole("link", { name: section, exact: true }),
        ).toBeVisible();
      }
    });
  });
}

test("the Pages group leads the sidebar's section groups", async ({
  page,
  biacDev,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${biacDev.url}/`);

  const nav = page.getByRole("navigation", { name: "Site navigation" });
  const firstGroup = nav.locator("details > summary").first();
  await expect(firstGroup).toHaveText("Pages");
});

const CHROME_ROUTE = "/pages/sidebar-contents-breadcrumbs";

test.describe("the sidebar, contents rail and breadcrumbs the reference describes", () => {
  test("a group closed by the reader stays closed after a reload", async ({
    page,
    biacDev,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}${CHROME_ROUTE}`);
    const nav = page.getByRole("navigation", { name: "Site navigation" });
    const group = nav.locator("details", { hasText: "Pages" }).first();
    await expect(group).toHaveAttribute("open", "");

    await group.locator("summary").click();
    await expect(group).not.toHaveAttribute("open", "");
    await page.reload();

    await expect(
      nav.locator("details", { hasText: "Pages" }).first(),
    ).not.toHaveAttribute("open", "");
  });

  test("the toggle hides the sidebar and below 1024 px opens a drawer that Escape closes", async ({
    page,
    biacDev,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}${CHROME_ROUTE}`);
    const toggle = page.getByRole("button", { name: "Toggle sidebar" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("the leaf breadcrumb is the current page and the rail indents a ### heading", async ({
    page,
    biacDev,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}${CHROME_ROUTE}`);

    const leaf = page
      .getByRole("navigation", { name: "breadcrumb" })
      .locator('[aria-current="page"]');
    await expect(leaf).toHaveText("Sidebar, table of contents and breadcrumbs");
    const toc = page.getByRole("navigation", { name: "On this page" });
    const subsection = await page.locator("main h3").first().textContent();
    const item = toc.locator("li", { hasText: subsection ?? "" }).first();
    await expect(item).toHaveClass(/pl-4/);
  });
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
