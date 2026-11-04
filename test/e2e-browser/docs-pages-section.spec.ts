import type { Locator, Page } from "@playwright/test";
import { readRootToken } from "./contrast.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

test.use({ biacProject: "docs", viewport: { width: 375, height: 812 } });

const PAGES = [
  {
    group: "Pages",
    route: "/pages/markdown-pages",
    title: "Markdown pages and front-matter",
  },
  { group: "Pages", route: "/pages/biac-config", title: "biac.config.ts" },
  {
    group: "Pages",
    route: "/pages/sidebar-contents-breadcrumbs",
    title: "Sidebar, table of contents and breadcrumbs",
  },
  {
    group: "Pages",
    route: "/pages/themes-and-brand",
    title: "Themes and brand",
  },
  {
    group: "Data",
    route: "/sql/sql-tables-and-fences",
    title: "SQL tables and fences",
  },
  {
    group: "Data",
    route: "/sql/params-in-queries",
    title: "Parameters in queries",
  },
  { group: "Data", route: "/sql/query-files", title: "Query files" },
  { group: "Data", route: "/sql/data-loaders", title: "Data loaders" },
  { group: "Data", route: "/sql/translations", title: "Translations" },
  { group: "Data", route: "/sql/site-search", title: "Site search" },
  {
    group: "Ship",
    route: "/ship/build-preview-serve",
    title: "Build, preview and serve",
  },
  {
    group: "Ship",
    route: "/ship/base-path",
    title: "Serve under a path prefix",
  },
];

for (const { group, route, title } of PAGES) {
  test.describe(`the ${title} reference`, () => {
    test(`sits in the ${group} sidebar group, titles the tab and its breadcrumb, and fits 375 px`, async ({
      page,
      biacDev,
    }) => {
      const errors = collectConsoleErrors(page);
      await page.goto(`${biacDev.url}${route}`);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page).toHaveTitle(title);
      const crumbs = page.getByRole("navigation", { name: "breadcrumb" });
      await expect(crumbs).toHaveText(
        new RegExp(
          `What is biac\\s*/\\s*${group}\\s*/\\s*${escapeRegExp(title)}`,
        ),
      );
      expect(await horizontalOverflowPx(page)).toBe(0);
      expect(errors).toEqual([]);
    });

    test(`is listed in the sidebar under a ${group} group`, async ({
      page,
      biacDev,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`${biacDev.url}${route}`);

      const nav = page.getByRole("navigation", { name: "Site navigation" });
      const details = nav.locator("details", { hasText: group }).first();
      await expect(details.getByRole("link", { name: title })).toHaveAttribute(
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

test.describe("the page brand the themes reference describes", () => {
  test("the example page fits 375 px with a clean console and a working chart", async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(`${biacDev.url}/pages/branded-page-example`);

    await expect(page).toHaveTitle("A branded page");
    await expect(page.getByRole("button", { name: "Biscoe" })).toBeVisible();
    await expect(page.locator("main canvas, main svg").first()).toBeVisible();
    expect(await horizontalOverflowPx(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  test("the example page has its own primary and the next page gets the project's back", async ({
    page,
    biacDev,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}/pages/themes-and-brand`);
    const projectPrimary = await readRootToken(page, "--primary");

    await page.goto(`${biacDev.url}/pages/branded-page-example`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "A branded page",
    );
    const pagePrimary = await readRootToken(page, "--primary");
    await page.getByRole("link", { name: "Themes and brand" }).last().click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Themes and brand",
    );
    expect(pagePrimary).toBe("#7c3aed");
    expect(projectPrimary).not.toBe(pagePrimary);
    expect(await readRootToken(page, "--primary")).toBe(projectPrimary);
  });
});

test.describe("the SQL tables and fences the reference describes", () => {
  test("a page's own sql table is queryable, and only display fences draw a result table", async ({
    page,
    biacDev,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}/sql/sql-tables-and-fences`);

    const main = page.locator("main");
    await expect(main.getByText("Penguins in the file")).toBeVisible();
    await expect(main.getByText("344", { exact: true })).toBeVisible();
    // The page's own Markdown tables also carry the table role, so the
    // result tables are told apart by their columns.
    const sexTable = main.getByRole("table").filter({ hasText: "unknown" });
    const speciesTable = main.getByRole("table").filter({ hasText: "Adelie" });
    await expect(sexTable).toHaveCount(1);
    await expect(sexTable.getByRole("columnheader")).toHaveText([
      "Sex",
      "Penguins",
    ]);
    await expect(speciesTable).toHaveCount(1);
    await expect(speciesTable.getByRole("columnheader")).toHaveText([
      "Species",
      "Avg Body Mass G",
    ]);
    await expect(
      main.getByRole("table").filter({ hasText: "island" }),
    ).toHaveCount(0);
  });

  test("a fence without display feeds a widget and draws no table of its own", async ({
    page,
    biacDev,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}/sql/sql-tables-and-fences`);

    await expect(page.locator("main canvas, main svg").first()).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

test.describe("the parameters the reference describes", () => {
  const route = "/sql/params-in-queries";

  test("a typed value reruns the queries that read it, lands in the URL and survives a reload", async ({
    page,
    biacDev,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}${route}`);
    const main = page.locator("main");
    const islands = islandsNamed(main).filter({ hasText: "Torgersen" });
    const typed = main.getByRole("table").filter({ hasText: "nothing typed" });
    await expect(islands.getByRole("row")).toHaveCount(4);
    await expect(typed).toBeVisible();

    await main.getByRole("textbox", { name: "Island name" }).fill("bis");
    await page.keyboard.press("Tab");

    await expect(page).toHaveURL(/\?island_text=bis$/);
    await expect(islands).toHaveCount(0);
    const biscoe = islandsNamed(main).filter({ hasText: "Biscoe" });
    await expect(biscoe.getByRole("row")).toHaveCount(2);
    await expect(
      main.getByRole("table").filter({ hasText: "Typed" }),
    ).toContainText("bis");

    await page.reload();

    await expect(
      main.getByRole("textbox", { name: "Island name" }),
    ).toHaveValue("bis");
    await expect(
      islandsNamed(main).filter({ hasText: "Biscoe" }).getByRole("row"),
    ).toHaveCount(2);
  });

  test("a MultiSelect's picks bind as a list, and an unset list keeps every island", async ({
    page,
    biacDev,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}${route}`);
    const main = page.locator("main");
    const picked = main.getByRole("table").filter({ hasText: "Species Count" });
    await expect(picked.getByRole("row")).toHaveCount(4);

    await main.getByRole("combobox", { name: "Islands" }).click();
    await page.getByRole("option", { name: "Dream" }).click();
    await page.getByRole("option", { name: "Biscoe" }).click();
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(
      /\?island_picks=%5B%22Dream%22%2C%22Biscoe%22%5D$/,
    );
    await expect(picked.getByRole("row")).toHaveCount(3);
    await expect(picked).not.toContainText("Torgersen");
    await expect(page.getByRole("alert")).toHaveCount(0);

    await main.getByRole("button", { name: "Remove Dream" }).click();
    await main.getByRole("button", { name: "Remove Biscoe" }).click();

    await expect(picked.getByRole("row")).toHaveCount(4);
  });

  test("a composed fence follows the value its inlined fence reads", async ({
    page,
    biacDev,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}${route}`);
    const main = page.locator("main");
    const species = main.getByRole("table").filter({ hasText: "Chinstrap" });
    await expect(species.getByRole("row")).toHaveCount(4);

    await main.getByRole("textbox", { name: "Island name" }).fill("bis");
    await page.keyboard.press("Tab");

    // Biscoe holds no Chinstrap penguin, so the species table loses that row.
    await expect(species).toHaveCount(0);
    const adelieAndGentoo = main
      .getByRole("table")
      .filter({ hasText: "Gentoo" })
      .filter({ hasText: "Adelie" });
    await expect(adelieAndGentoo.getByRole("row")).toHaveCount(3);
  });

  test("a typed number binds as a DOUBLE", async ({ page, biacDev }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}${route}?island_text=42`);

    const typed = page
      .locator("main")
      .getByRole("table")
      .filter({ hasText: "Typed" });
    await expect(typed).toContainText("42.0");
  });

  test("the page draws no query error and logs no console error", async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}${route}`);
    await expect(page.locator("main").getByRole("table").first()).toBeVisible();

    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe("the query files the reference describes", () => {
  const route = "/sql/query-files";

  test("a file is a widget's data and a fence's subquery", async ({
    page,
    biacDev,
  }) => {
    const main = await openAtDesktopWidth(page, `${biacDev.url}${route}`);

    const fromFile = main.getByRole("table").filter({ hasText: "Torgersen" });
    await expect(fromFile).toHaveCount(2);
    await expect(fromFile.first().getByRole("row")).toHaveCount(4);
    const largeIslands = main
      .getByRole("table")
      .filter({ hasText: "Dream" })
      .filter({ hasNotText: "Torgersen" });
    await expect(largeIslands.getByRole("row")).toHaveCount(3);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("a parameter inside a file narrows the table that reads it, and the URL carries it", async ({
    page,
    biacDev,
  }) => {
    const main = await openAtDesktopWidth(page, `${biacDev.url}${route}`);
    const searched = main.getByRole("table").filter({ hasText: "Torgersen" });
    await expect(searched).toHaveCount(2);

    await main.getByRole("textbox", { name: "Island name" }).fill("bis");
    await page.keyboard.press("Tab");

    await expect(page).toHaveURL(/\?island_text=bis$/);
    await expect(searched).toHaveCount(1);
    const biscoe = main.getByRole("table").filter({ hasText: "168" });
    await expect(biscoe.last().getByRole("row")).toHaveCount(2);
  });
});

test.describe("the data loader the reference runs", () => {
  test("its output is a table the page queries, with no error", async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    const main = await openAtDesktopWidth(
      page,
      `${biacDev.url}/sql/data-loaders`,
    );

    const summary = main.getByRole("table").filter({ hasText: "Torgersen" });
    await expect(summary.first().getByRole("row")).toHaveCount(4);
    await expect(summary.first()).toContainText("168");
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

/** Opens `url` at 1280 px and returns the page's `main` landmark. */
async function openAtDesktopWidth(page: Page, url: string): Promise<Locator> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url);
  return page.locator("main");
}

/** The `islands_named` table: the only one under a Penguins header that lists islands. */
function islandsNamed(main: Locator): Locator {
  return main.getByRole("table").filter({ hasText: "Penguins" });
}

/** Pixels the page is wider than the window; 0 means nothing scrolls sideways. */
function horizontalOverflowPx(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
