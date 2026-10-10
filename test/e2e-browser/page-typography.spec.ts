import type { Locator } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

interface TypeMetrics {
  fontSize: string;
  fontWeight: string;
  marginBottom: string;
}

function typeMetrics(element: Locator): Promise<TypeMetrics> {
  return element.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      marginBottom: style.marginBottom,
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
    await expect(title).toBeVisible({ timeout: 20_000 });

    const h1 = await typeMetrics(title);
    const paragraph = await typeMetrics(page.locator("main > p").first());
    // The article's last paragraph ends flush; every other one leaves a gap.
    const gaps = await page
      .locator("main > p:not(:last-child)")
      .evaluateAll((nodes) =>
        nodes.map((node) => parseFloat(getComputedStyle(node).marginBottom)),
      );

    expect(h1).toMatchObject({ fontSize: "30px", fontWeight: "700" });
    expect(paragraph.fontSize).toBe("16px");
    expect(gaps.every((gap) => gap > 0)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("section headings step down the scale while widget text keeps its own", async ({
  page,
  biacDev,
}) => {
  await page.goto(`${biacDev.url}/weekly-review`);
  await expect(page.locator("main > h1")).toBeVisible({ timeout: 20_000 });

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

// Measures the first in-text link against its paragraph. Tailwind 4 colors
// compute as oklch(), so each is painted on a 1×1 canvas to read back sRGB
// before applying the WCAG 2 relative-luminance formula.
function linkLook(link: Locator): Promise<LinkLook> {
  return link.evaluate((anchor) => {
    const context = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    })!;
    const weights = [0.2126, 0.7152, 0.0722];
    const luminance = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data)
        .slice(0, 3)
        .map((channel) => channel / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((sum, c, i) => sum + c * (weights[i] ?? 0), 0);
    };
    const link = luminance(getComputedStyle(anchor).color);
    const text = luminance(getComputedStyle(anchor.parentElement!).color);
    const [lighter, darker] = [Math.max(link, text), Math.min(link, text)];
    return {
      contrastWithText: (lighter + 0.05) / (darker + 0.05),
      decoration: getComputedStyle(anchor).textDecorationLine,
    };
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`a ${colorScheme} page link is underlined and colored apart from its paragraph`, async ({
    page,
    biacDev,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(`${biacDev.url}/weekly-review`);
    const link = page.locator("main > p a").first();
    await expect(link).toBeVisible({ timeout: 20_000 });

    const look = await linkLook(link);

    // WCAG 1.4.1 (technique G183): ≥ 3:1 against the surrounding text.
    expect(look.contrastWithText).toBeGreaterThanOrEqual(3);
    expect(look.decoration).toBe("underline");
  });
}

test("a page link shows a focus outline when reached by keyboard", async ({
  page,
  biacDev,
}) => {
  await page.goto(`${biacDev.url}/nested/page`);
  const link = page.locator("main > p a").first();
  await expect(link).toBeVisible({ timeout: 20_000 });

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
