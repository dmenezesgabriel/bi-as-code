import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expect,
  openOrderMixRow,
  test,
} from "./dev-server.fixture.js";

const PAGE_FILE = "pages/weekly-review.md";

function sourceEditor(page: Page) {
  return page.getByRole("textbox", { name: "Page source" });
}

function editorStatus(page: Page) {
  return page
    .getByRole("region", { name: "Source editor", exact: true })
    .getByRole("status");
}

/** Appends `text` to the editor line reading exactly `line`. */
async function appendToLine(page: Page, line: string, text: string) {
  await page.locator(".cm-line", { hasText: new RegExp(`^${line}$`) }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
}

async function saveWithModS(page: Page) {
  await page.keyboard.press("ControlOrMeta+s");
  await expect(editorStatus(page)).toHaveText("Saved", { timeout: 10_000 });
}

/** A full reload discards window properties; the marker proves none ran. */
async function markWindow(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __probe: string }).__probe = "kept";
  });
}

function windowMarker(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __probe?: string }).__probe,
  );
}

async function openEditorFromHeader(page: Page, url: string) {
  await page.goto(`${url}weekly-review?region=West`);
  // Settle every widget first: the Amount slider then holds its silent
  // bounds correction, which a later hot swap must not publish.
  expect(await openOrderMixRow(page, "Page 1 of 2 · 13 rows")).toEqual([
    "1",
    "West",
    "4",
    "175",
  ]);
  await markWindow(page);
  await page.getByRole("banner").getByRole("link", { name: "Edit" }).click();
  await expect(sourceEditor(page)).toContainText("# Weekly review", {
    timeout: 20_000,
  });
}

test("edits a page from the header: Mod-s saves to disk and the preview swaps in place", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  const file = join(biacDev.projectDir, PAGE_FILE);
  await openEditorFromHeader(page, biacDev.url);
  const url = new URL(page.url());
  expect(url.searchParams.get("region")).toBe("West");
  expect(url.searchParams.get("edit")).toBe("true");
  await expect(editorStatus(page)).toHaveText("No unsaved changes");

  await appendToLine(page, "# Weekly review", ", edited");
  await expect(editorStatus(page)).toHaveText("Unsaved changes");
  await saveWithModS(page);

  expect(readFileSync(file, "utf8")).toContain("\n# Weekly review, edited\n");
  const preview = page.getByRole("region", {
    name: "Live preview",
    exact: true,
  });
  await expect(
    preview.getByRole("heading", { level: 1, name: "Weekly review, edited" }),
  ).toBeVisible({ timeout: 20_000 });
  expect(await windowMarker(page)).toBe("kept");
  await expect(page.getByRole("combobox", { name: "Region" })).toContainText(
    "West",
  );

  await appendToLine(page, "# Weekly review, edited", " twice");
  await saveWithModS(page);
  await expect(
    preview.getByRole("heading", { name: "Weekly review, edited twice" }),
  ).toBeVisible({ timeout: 20_000 });
  expect(new URL(page.url()).searchParams.get("region")).toBe("West");
  expect(await windowMarker(page)).toBe("kept");
  expect(errors).toEqual([]);
});

test("a reload reopens the saved source, and Done returns to the plain page", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await openEditorFromHeader(page, biacDev.url);
  await appendToLine(page, "# Weekly review", ", on disk");
  await saveWithModS(page);

  await page.reload();
  await expect(sourceEditor(page)).toContainText("# Weekly review, on disk", {
    timeout: 20_000,
  });
  await page.getByRole("banner").getByRole("link", { name: "Done" }).click();

  await expect(
    page.getByRole("region", { name: "Live preview", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: "Weekly review, on disk" }),
  ).toBeVisible();
  const url = new URL(page.url());
  expect(url.searchParams.has("edit")).toBe(false);
  expect(url.searchParams.get("region")).toBe("West");
  expect(errors).toEqual([]);
});

test("the panes sit side by side at desktop width and stack on a phone", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const boxes = async () => {
    const source = await page
      .getByRole("region", { name: "Source editor", exact: true })
      .boundingBox();
    const preview = await page
      .getByRole("region", { name: "Live preview", exact: true })
      .boundingBox();
    if (!source || !preview) throw new Error("an editor pane has no box");
    return { source, preview };
  };
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${biacDev.url}weekly-review?edit`);
  await expect(sourceEditor(page)).toBeVisible({ timeout: 20_000 });

  const wide = await boxes();
  expect(wide.preview.x).toBeGreaterThanOrEqual(
    wide.source.x + wide.source.width,
  );
  expect(wide.preview.y).toBe(wide.source.y);
  // Each pane scrolls inside itself; the document must not, or the header
  // and the save status scroll away with a long page.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    ),
  ).toBe(0);
  // Half a 1280px viewport beside the sidebar leaves no room for the
  // right-rail ToC; it would squeeze the previewed page to a sliver.
  await expect(
    page.getByRole("navigation", { name: "On this page" }),
  ).toBeHidden();
  // Scrolled past the filter bar, it docks just under the pane's top edge —
  // not 4rem down, where the page would show through above it.
  const gapAboveDockedBar = await page.evaluate(async () => {
    const pane = document.querySelector('section[aria-label="Live preview"]');
    const bar = document.querySelector('[role="combobox"]')?.closest(".sticky");
    if (!pane || !bar) throw new Error("no preview pane or filter bar");
    pane.scrollTop = 2000;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return bar.getBoundingClientRect().top - pane.getBoundingClientRect().top;
  });
  expect(gapAboveDockedBar).toBe(16);

  await page.setViewportSize({ width: 375, height: 800 });
  const narrow = await boxes();
  expect(narrow.preview.y).toBeGreaterThanOrEqual(
    narrow.source.y + narrow.source.height,
  );
  expect(narrow.source.width).toBe(narrow.preview.width);
  // Stacked, the window scrolls again under the 3rem header, so the filter
  // bar docks 1rem below the header as on any page — not behind it.
  const barTopInViewport = await page.evaluate(async () => {
    const bar = document.querySelector('[role="combobox"]')?.closest(".sticky");
    if (!bar) throw new Error("no filter bar");
    window.scrollTo(0, 4000);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return bar.getBoundingClientRect().top;
  });
  expect(barTopInViewport).toBe(64);
  expect(errors).toEqual([]);
});
