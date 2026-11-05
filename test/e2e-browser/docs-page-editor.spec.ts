import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

test.use({ biacProject: "docs" });

const ROUTE = "/ship/page-editor";
const GUIDE = new URL("../../docs/pages/ship/page-editor.md", import.meta.url);

function sourceRegion(page: Page) {
  return page.getByRole("region", { name: "Source editor", exact: true });
}

function previewRegion(page: Page) {
  return page.getByRole("region", { name: "Live preview", exact: true });
}

/** The line the guide quotes as the leave prompt: the text fence naming it. */
function quotedLeavePrompt(): string {
  const fence = readFileSync(GUIDE, "utf8").match(
    /```text\n(Leave this page\?[^\n]*)\n```/,
  );
  return fence?.[1] ?? "";
}

for (const width of [1280, 375]) {
  test(`the guide's screenshots load and keep the page inside ${width} px`, async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${biacDev.url}${ROUTE}`);

    const images = page.locator("main img");
    await expect(images).toHaveCount(2);
    const widths = await images.evaluateAll((all) =>
      all.map((image) => (image as HTMLImageElement).naturalWidth),
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );

    // A missing screenshot builds and shows a broken image (backlog Known debt).
    expect(widths.every((natural) => natural > 0)).toBe(true);
    expect(overflow).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("the header's Edit link opens the editor beside the guide, and Done closes it", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${biacDev.url}${ROUTE}`);

  await page.getByRole("banner").getByRole("link", { name: "Edit" }).click();

  await expect(page).toHaveURL(/[?&]edit=true\b/);
  await expect(sourceRegion(page).getByRole("status")).toHaveText(
    "No unsaved changes",
  );
  await expect(sourceRegion(page)).toContainText("pages/ship/page-editor.md");
  await expect(
    previewRegion(page).getByRole("heading", {
      level: 1,
      name: "The page editor",
    }),
  ).toBeVisible();

  await page.getByRole("banner").getByRole("link", { name: "Done" }).click();

  await expect(sourceRegion(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/edit=/);
  expect(errors).toEqual([]);
});

test("leaving with unsaved text asks the question the guide quotes, and Cancel keeps the text", async ({
  page,
  biacDev,
}) => {
  const asked: string[] = [];
  page.on("dialog", (dialog) => {
    asked.push(dialog.message());
    void dialog.dismiss();
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${biacDev.url}${ROUTE}?edit=true`);
  await page.locator(".cm-line").first().click();
  await page.keyboard.type("x");
  await expect(sourceRegion(page).getByRole("status")).toHaveText(
    "Unsaved changes",
  );

  await page.getByRole("banner").getByRole("link", { name: "Done" }).click();

  await expect.poll(() => asked).toEqual([quotedLeavePrompt()]);
  await expect(sourceRegion(page).getByRole("status")).toHaveText(
    "Unsaved changes",
  );
});
