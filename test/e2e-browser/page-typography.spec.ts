import type { Locator } from "@playwright/test";
import { contrastRatio } from "./contrast.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

interface TypeMetrics {
  fontSize: string;
  fontWeight: string;
}

function typeMetrics(element: Locator): Promise<TypeMetrics> {
  return element.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
    };
  });
}

// Markdown elements render as direct children of the article; widget
// markup sits deeper, so `main >` selects only what the MDX map styles.
for (const route of [
  "/",
  "/weekly-review",
  "/nested/allocation",
  "/nested/page",
]) {
  test(`${route} renders its title above body text and spaces its paragraphs`, async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(`${biacDev.url}${route}`);
    const title = page.locator("main > h1");
    await expect(title).toBeVisible();

    const h1 = await typeMetrics(title);
    const paragraph = await typeMetrics(page.locator("main > p").first());
    // A paragraph sits one block gap above the body block after it; a
    // heading below keeps its own larger space, so it is not measured.
    const gaps = await page
      .locator("main > p:has(+ :not(h1, h2, h3, h4, h5, h6, br))")
      .evaluateAll((nodes) =>
        nodes.map(
          (node) =>
            node.nextElementSibling!.getBoundingClientRect().top -
            node.getBoundingClientRect().bottom,
        ),
      );

    expect(h1).toMatchObject({ fontSize: "30px", fontWeight: "700" });
    expect(paragraph.fontSize).toBe("16px");
    expect(gaps).toEqual(gaps.map(() => 16));
    expect(errors).toEqual([]);
  });
}

test("section headings step down the scale while widget text keeps its own", async ({
  page,
  biacDev,
}) => {
  await page.goto(`${biacDev.url}/weekly-review`);
  await expect(page.locator("main > h1")).toBeVisible();

  const h2 = await typeMetrics(page.locator("main > h2").first());
  const h3 = await typeMetrics(page.locator("main > h3").first());
  // A widget's literal JSX bypasses the MDX map: the callout title keeps
  // its own bold body-size heading.
  const calloutTitle = await typeMetrics(
    page.getByRole("heading", { name: "Reading guide" }),
  );

  expect(h2).toMatchObject({ fontSize: "24px", fontWeight: "600" });
  expect(h3).toMatchObject({ fontSize: "20px", fontWeight: "600" });
  expect(calloutTitle).toMatchObject({ fontSize: "16px", fontWeight: "700" });
});

interface LinkLook {
  contrastWithText: number;
  decoration: string;
}

// Measures the first in-text link against its paragraph.
async function linkLook(link: Locator): Promise<LinkLook> {
  const colors = await link.evaluate((anchor) => ({
    link: getComputedStyle(anchor).color,
    text: getComputedStyle(anchor.parentElement!).color,
    decoration: getComputedStyle(anchor).textDecorationLine,
  }));
  return {
    contrastWithText: await contrastRatio(
      link.page(),
      colors.link,
      colors.text,
    ),
    decoration: colors.decoration,
  };
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`a ${colorScheme} page link is underlined and colored apart from its paragraph`, async ({
    page,
    biacDev,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(`${biacDev.url}/weekly-review`);
    const link = page.locator("main > p a").first();
    await expect(link).toBeVisible();

    const look = await linkLook(link);

    // WCAG 1.4.1 (technique G183): ≥ 3:1 against the surrounding text.
    expect(look.contrastWithText).toBeGreaterThanOrEqual(3);
    expect(look.decoration).toBe("underline");
  });
}

interface FenceSurface {
  background: string;
  muted: string;
  radius: string;
  radiusMd: string;
  padding: number[];
  fontSize: string;
}

/** The highlighted fence's look beside the tokens it should resolve to,
 * each read back through a probe so both sides are computed values. The
 * corner is probed through the `rounded-md` utility: `@theme inline`
 * writes the step into the utility and emits no `--radius-md` at runtime. */
function fenceSurface(pre: Locator): Promise<FenceSurface> {
  return pre.evaluate((node) => {
    const probe = document.createElement("div");
    probe.style.background = "var(--muted)";
    probe.className = "rounded-md";
    node.parentElement!.append(probe);
    const tokens = getComputedStyle(probe);
    const look = getComputedStyle(node);
    const surface = {
      background: look.backgroundColor,
      muted: tokens.backgroundColor,
      radius: getComputedStyle(node.parentElement!).borderTopLeftRadius,
      radiusMd: tokens.borderTopLeftRadius,
      padding: [
        look.paddingTop,
        look.paddingRight,
        look.paddingBottom,
        look.paddingLeft,
      ].map(parseFloat),
      fontSize: look.fontSize,
    };
    probe.remove();
    return surface;
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`a ${colorScheme} SQL fence sits on the muted surface, rounded, padded and in small type`, async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.emulateMedia({ colorScheme });
    await page.goto(`${biacDev.url}/weekly-review`);
    const pre = page.locator("main pre.shiki").first();
    await expect(pre).toBeVisible();

    const surface = await fenceSurface(pre);

    expect(surface.background).toBe(surface.muted);
    expect(surface.radius).toBe(surface.radiusMd);
    expect(Math.min(...surface.padding)).toBeGreaterThan(0);
    expect(surface.fontSize).toBe("14px");
    expect(errors).toEqual([]);
  });

  test(`every ${colorScheme} SQL token reads at text contrast on its fence`, async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.emulateMedia({ colorScheme });
    await page.goto(`${biacDev.url}/weekly-review`);
    // Token spans carry shiki's inline colors; the .line wrapper only
    // inherits the fence foreground.
    const fence = page.locator("main pre.shiki").first();
    await expect(
      fence.locator("span[style]", { hasText: /^-- composes/ }),
    ).toBeVisible();

    const colors = await fence.evaluate((pre) => ({
      tokens: [
        ...new Set(
          [...pre.querySelectorAll("span[style]")].map(
            (span) => getComputedStyle(span).color,
          ),
        ),
      ],
      fence: getComputedStyle(pre).backgroundColor,
    }));

    // WCAG 1.4.3: body-size text needs 4.5:1 against its background.
    expect(colors.tokens.length).toBeGreaterThan(2);
    for (const token of colors.tokens) {
      expect(
        await contrastRatio(page, token, colors.fence),
        `${token} on ${colors.fence}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(errors).toEqual([]);
  });
}

test("a page link shows a focus outline when reached by keyboard", async ({
  page,
  biacDev,
}) => {
  await page.goto(`${biacDev.url}/nested/page`);
  const link = page.locator("main > p a").first();
  await expect(link).toBeVisible();

  await link.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const outline = await link.evaluate((anchor) => {
    const style = getComputedStyle(anchor);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });

  await expect(link).toBeFocused();
  expect(outline).toEqual({ style: "solid", width: "2px" });
});

interface CellLook {
  paddingRight: number;
  borderBottomWidth: string;
  textAlign: string;
  fontWeight: string;
}

function cellLook(cell: Locator): Promise<CellLook> {
  return cell.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      paddingRight: parseFloat(style.paddingRight),
      borderBottomWidth: style.borderBottomWidth,
      textAlign: style.textAlign,
      fontWeight: style.fontWeight,
    };
  });
}

// The rendered width of a cell's text, not of the cell box: right-aligned
// labels that touch show up as a zero gap between these boxes.
function textBounds(cell: Locator): Promise<{ left: number; right: number }> {
  return cell.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const { left, right } = range.getBoundingClientRect();
    return { left, right };
  });
}

test("a markdown table pads its header cells and rules its rows", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}/nested/allocation`);
  const table = page.locator("main > table");
  await expect(table).toBeVisible();

  const share = table.getByRole("columnheader", { name: "Share" });
  const orders = table.getByRole("columnheader", { name: "Orders" });
  const shareLook = await cellLook(share);
  const gap = (await textBounds(orders)).left - (await textBounds(share)).right;
  const rows = await table
    .getByRole("cell")
    .evaluateAll((cells) =>
      cells.map((cell) => getComputedStyle(cell).borderBottomWidth),
    );
  const orderCount = await cellLook(table.getByRole("cell", { name: "163" }));

  expect(shareLook.paddingRight).toBeGreaterThan(0);
  expect(gap).toBeGreaterThanOrEqual(shareLook.paddingRight);
  expect(new Set(rows)).toEqual(new Set(["1px"]));
  expect(orderCount.textAlign).toBe("right");
  expect(errors).toEqual([]);
});

test("the Table widget keeps its own header cells beside markdown tables", async ({
  page,
  biacDev,
}) => {
  await page.goto(`${biacDev.url}/weekly-review`);
  // Only the widget's sortable header carries aria-sort; the page's own
  // GFM table header does not.
  const header = page.locator("main th[aria-sort]:visible").first();
  await expect(header).toBeVisible();

  const look = await cellLook(header);

  expect(look).toMatchObject({
    paddingRight: 16,
    borderBottomWidth: "1px",
    fontWeight: "500",
  });
});

interface FenceScroll {
  pageOverflow: number;
  scrollWidth: number;
  clientWidth: number;
  preWidth: number;
  prePaddingRight: number;
}

function fenceScroll(scroller: Locator): Promise<FenceScroll> {
  return scroller.evaluate((node) => ({
    pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
    preWidth: (node.firstElementChild as HTMLElement).offsetWidth,
    prePaddingRight: parseFloat(
      getComputedStyle(node.firstElementChild!).paddingRight,
    ),
  }));
}

for (const route of ["/", "/weekly-review"]) {
  test(`${route} scrolls a wide code fence inside itself on a phone`, async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${biacDev.url}${route}`);
    // The highlighted fence's scroller is the parent of shiki's `pre`.
    const scroller = page.locator("main :has(> pre.shiki):visible").first();
    await expect(scroller).toBeVisible();

    const scroll = await fenceScroll(scroller);
    await scroller.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowRight");

    expect(scroll.pageOverflow).toBe(0);
    expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
    expect(scroll.preWidth).toBe(scroll.scrollWidth);
    // The gutter is part of the pre's width, so a fence scrolled to its
    // end still shows it after the last column.
    expect(scroll.prePaddingRight).toBeGreaterThan(0);
    await expect(scroller).toBeFocused();
    await expect
      .poll(() => scroller.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}
