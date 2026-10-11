import { readFileSync, writeFileSync } from "node:fs";
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

function livePreview(page: Page) {
  return page.getByRole("region", { name: "Live preview", exact: true });
}

/**
 * The preview shows `location` as the page's compile error while the app
 * around it stands: no vite overlay over the editor, and no full reload.
 */
async function expectCompileErrorInPreview(page: Page, location: RegExp) {
  const alert = livePreview(page).getByRole("alert");
  await expect(alert).toContainText("This page failed to compile", {
    timeout: 20_000,
  });
  await expect(alert).toContainText(location);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await expect(sourceEditor(page)).toBeVisible();
  expect(await windowMarker(page)).toBe("kept");
}

async function expectPageBackInPreview(page: Page) {
  await expect(
    livePreview(page).getByRole("heading", { level: 1, name: "Weekly review" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(livePreview(page).getByRole("alert")).toHaveCount(0);
  expect(await windowMarker(page)).toBe("kept");
}

/**
 * Answers every dialog the page raises — `confirm` and `beforeunload` alike —
 * with `accept`, and logs each as `"<type>: <message>"` in `seen`.
 */
function answerDialogs(page: Page) {
  const dialogs = { seen: [] as string[], accept: false };
  page.on("dialog", async (dialog) => {
    dialogs.seen.push(`${dialog.type()}: ${dialog.message()}`);
    await (dialogs.accept ? dialog.accept() : dialog.dismiss());
  });
  return dialogs;
}

function sidebarLink(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Site navigation" })
    .getByRole("link", { name });
}

const LEAVE_ASK =
  "confirm: Leave this page? Your unsaved changes will be lost.";

/** Opens the editor and types ` zz` on the heading, unsaved. */
async function openWithUnsavedEdit(page: Page, url: string) {
  await openEditorFromHeader(page, url);
  const dialogs = answerDialogs(page);
  await appendToLine(page, "# Weekly review", " zz");
  await expect(editorStatus(page)).toHaveText("Unsaved changes");
  return dialogs;
}

async function eraseTyped(page: Page, text: string) {
  for (let typed = text.length; typed > 0; typed--) {
    await page.keyboard.press("Backspace");
  }
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
  // bar docks 1rem below the header as on any page — not behind it. Polled:
  // the bar transitions every property, its dock offset included, so for
  // 150ms after the viewport crosses `lg` it is still sliding into place.
  const barTopInViewport = () =>
    page.evaluate(() => {
      const bar = document
        .querySelector('[role="combobox"]')
        ?.closest(".sticky");
      if (!bar) throw new Error("no filter bar");
      window.scrollTo(0, 4000);
      return bar.getBoundingClientRect().top;
    });
  await expect.poll(barTopInViewport).toBe(64);
  expect(errors).toEqual([]);
});

test("a broken tag shows its compile error in the preview, and the fix renders the page again", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await openEditorFromHeader(page, biacDev.url);

  await appendToLine(page, "# Weekly review", "\n<Callout");
  await saveWithModS(page);

  await expectCompileErrorInPreview(page, /pages\/weekly-review\.md:\d+:\d+/);

  await eraseTyped(page, "\n<Callout");
  await expect(editorStatus(page)).toHaveText("Unsaved changes");
  await saveWithModS(page);

  await expectPageBackInPreview(page);
  expect(errors).toEqual([]);
});

test("broken front-matter shows its error in the preview instead of taking the app down", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await openEditorFromHeader(page, biacDev.url);

  // A second `:` on the line is a nested mapping YAML rejects; brackets and
  // quotes would be auto-closed by the editor into valid YAML.
  await appendToLine(page, "title: Weekly review", ": x");
  await saveWithModS(page);

  await expectCompileErrorInPreview(page, /pages\/weekly-review\.md:2:\d+/);

  await eraseTyped(page, ": x");
  await saveWithModS(page);

  await expectPageBackInPreview(page);
  expect(errors).toEqual([]);
});

test("a page already broken on disk still opens in the editor", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const file = join(biacDev.projectDir, PAGE_FILE);
  writeFileSync(
    file,
    readFileSync(file, "utf8").replace(
      "# Weekly review\n",
      "# Weekly review\n<Callout\n",
    ),
  );

  await page.goto(`${biacDev.url}weekly-review?edit`);

  await expect(sourceEditor(page)).toContainText("<Callout", {
    timeout: 20_000,
  });
  await expect(livePreview(page).getByRole("alert")).toContainText(
    "This page failed to compile",
  );
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("leaving an editor with unsaved changes asks first; a filter change does not", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  const file = join(biacDev.projectDir, PAGE_FILE);
  const onDisk = readFileSync(file, "utf8");
  const dialogs = await openWithUnsavedEdit(page, biacDev.url);

  await sidebarLink(page, "Orders overview").click();
  await expect.poll(() => dialogs.seen).toEqual([LEAVE_ASK]);
  expect(new URL(page.url()).pathname).toBe("/weekly-review");
  expect(new URL(page.url()).searchParams.get("edit")).toBe("true");
  await expect(sourceEditor(page)).toContainText("# Weekly review zz");
  await expect(editorStatus(page)).toHaveText("Unsaved changes");

  await page.getByRole("combobox", { name: "Region" }).click();
  await page.getByRole("option", { name: "North" }).click();
  await expect(page).toHaveURL(/region=North/);
  expect(dialogs.seen).toHaveLength(1);

  const done = page.getByRole("banner").getByRole("link", { name: "Done" });
  await done.click();
  await expect.poll(() => dialogs.seen).toHaveLength(2);
  await expect(sourceEditor(page)).toContainText("# Weekly review zz");

  dialogs.accept = true;
  await done.click();
  await expect(livePreview(page)).toHaveCount(0);
  const url = new URL(page.url());
  expect(url.searchParams.has("edit")).toBe(false);
  expect(url.searchParams.get("region")).toBe("North");
  expect(dialogs.seen).toEqual([LEAVE_ASK, LEAVE_ASK, LEAVE_ASK]);
  expect(readFileSync(file, "utf8")).toBe(onDisk);
  expect(errors).toEqual([]);
});

test("reloading an unsaved buffer raises the browser's leave prompt", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  const dialogs = await openWithUnsavedEdit(page, biacDev.url);

  // Dismissing the prompt cancels the reload, so there is no load to await.
  await page.evaluate(() => location.reload());

  await expect.poll(() => dialogs.seen).toEqual(["beforeunload: "]);
  await expect(sourceEditor(page)).toContainText("# Weekly review zz");
  expect(await windowMarker(page)).toBe("kept");
  expect(errors).toEqual([]);
});

test("a saved buffer leaves the editor without asking", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  const dialogs = await openWithUnsavedEdit(page, biacDev.url);
  await saveWithModS(page);

  await sidebarLink(page, "Orders overview").click();

  await expect(page).toHaveURL(`${biacDev.url}`);
  expect(dialogs.seen).toEqual([]);
  expect(errors).toEqual([]);
});
