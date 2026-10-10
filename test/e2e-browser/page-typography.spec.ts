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
