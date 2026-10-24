import type { Page } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildProject,
  startBiacServer,
  startDevServer,
  type DevServer,
} from "../lib/dev-server.js";
import { copyShippedProject } from "../lib/shipped-project.js";
import {
  installCrossfilterProbe,
  pageNow,
  readProbe,
  waitForSettled,
} from "./crossfilter-probe.js";
import {
  abandonScalePageQueries,
  expectAbandonedQueriesPostedNothingLate,
} from "./crossfilter-gestures.js";
import {
  collectConsoleErrors,
  collectWorkerConsoleLines,
  expect,
  test,
} from "./dev-server.fixture.js";
import {
  chartPoint,
  chartHosts,
  expectScatterRegions,
  openWeeklyReviewCharts,
  readyCharts,
} from "./echart-hosts.js";
import { chooseLanguage, documentLanguage } from "./language-menu.js";
import { cardCount, mainWidth, readCards } from "./widget-cards.js";

// chromium-headless-shell crashes its renderer under 200k-row slider
// re-queries on crossfilter-scale; Chrome's new headless completes them
// (see crossfilter-scale.spec.ts).
test.use({ channel: "chromium" });

// One build + preview per worker: every test here only reads the build.
let projectDir: string;
let preview: DevServer;

function shippedCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), "biac-static-"));
  copyShippedProject(dir);
  return dir;
}

test.beforeAll(async () => {
  projectDir = shippedCopy();
  buildProject(projectDir);
  preview = await startBiacServer("preview", projectDir);
});

test.afterAll(async () => {
  await preview.stop();
  rmSync(projectDir, { recursive: true, force: true });
});

test.beforeEach(async ({ page }) => {
  await installCrossfilterProbe(page);
});

/**
 * Clicks the West bar and returns ms from the click to the scatter's first
 * repaint — the Order mix chart is a `filters={["region"]}` consumer, so
 * its repaint is the cross-filter round trip: publish, re-query, paint.
 */
async function westClickLatency(page: Page, regions: string[]) {
  await waitForSettled(page);
  const west = await chartPoint(page, 0, [0, 3000]);
  const clickedAt = await pageNow(page);
  await page.mouse.click(west.x, west.y);
  await expectScatterRegions(page, regions);
  const { paints } = await readProbe(page);
  const repaint = paints.find(
    (p) => p.chart === "order mix" && p.t > clickedAt,
  );
  if (!repaint) throw new Error(`no "order mix" paint after t=${clickedAt}`);
  return repaint.t - clickedAt;
}

/** Select, clear, select — the median of three round trips. */
async function medianWestClickLatency(page: Page): Promise<number> {
  await chartHosts(page).nth(0).scrollIntoViewIfNeeded();
  const all = ["North", "South", "West"];
  const latencies = [
    await westClickLatency(page, ["West"]),
    await westClickLatency(page, all),
    await westClickLatency(page, ["West"]),
  ].sort((a, b) => a - b);
  return Math.round(latencies[1] ?? NaN);
}

test("a Regional split bar click cross-filters weekly-review off the static build", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, preview.url);

  const ms = await medianWestClickLatency(page);

  // The last click left West selected: order_detail pages down to its rows.
  await expect(page.getByText("Page 1 of 14 · 140 rows")).toHaveCount(1);
  test
    .info()
    .annotations.push({ type: "xf-latency-ms", description: `preview ${ms}` });
  expect(errors).toEqual([]);
});

// The same gesture on `biac dev`, so the preview number has a baseline
// measured under the same host load. No threshold: the host is shared.
test("the same bar click on biac dev, as the latency baseline", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  const devDir = shippedCopy();
  const dev = await startDevServer(devDir);
  try {
    await openWeeklyReviewCharts(page, dev.url);
    const ms = await medianWestClickLatency(page);
    test
      .info()
      .annotations.push({ type: "xf-latency-ms", description: `dev ${ms}` });
  } finally {
    dev.kill();
    rmSync(devDir, { recursive: true, force: true });
  }
  expect(errors).toEqual([]);
});

test("a deep-link reload of crossfilter-scale renders through the SPA fallback", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${preview.url}crossfilter-scale`);
  await page.reload();

  await expect(readyCharts(page)).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("leaving crossfilter-scale mid-query posts nothing for a disconnected connection off the static build", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  const workerLines = collectWorkerConsoleLines(page);

  await abandonScalePageQueries(page, preview.url);

  await expectAbandonedQueriesPostedNothingLate(page);
  expect(workerLines).toEqual([]);
  expect(errors).toEqual([]);
});

test("the static build offers no page editor, even on ?edit", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  const heading = page.getByRole("heading", { level: 1 });
  const editLink = page.getByRole("link", { name: "Edit", exact: true });

  await page.goto(`${preview.url}weekly-review`);
  await expect(heading).toHaveCount(1);
  await expect(editLink).toHaveCount(0);

  await page.goto(`${preview.url}weekly-review?edit`);
  await expect(heading).toHaveCount(1);
  await expect(editLink).toHaveCount(0);
  await expect(page.locator(".cm-editor")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the static build chooses the page language from ?lang= and the header menu", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  const heading = page.getByRole("heading", { level: 1 });

  await page.goto(`${preview.url}weekly-review?lang=fr`);
  await expect(heading).toHaveText("Revue hebdomadaire");
  expect(await documentLanguage(page)).toBe("fr");

  await page.goto(`${preview.url}weekly-review`);
  await expect(heading).toHaveText("Weekly review");
  await chooseLanguage(page, "Français");
  await expect(heading).toHaveText("Revue hebdomadaire");

  // No ?lang= — the stored choice applies with no server to read it.
  await page.goto(`${preview.url}weekly-review`);
  await expect(heading).toHaveText("Revue hebdomadaire");
  expect(await documentLanguage(page)).toBe("fr");
  expect(errors).toEqual([]);
});

test("the orders dashboard keeps its full width and cards off the static build", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${preview.url}orders-dashboard`);

  await expect.poll(() => cardCount(page), { timeout: 20_000 }).toBe(6);
  expect(await readCards(page)).toMatchObject({
    nested: 0,
    tint: "rgb(250, 250, 250)",
  });
  // 896px is the article cap on a page without a ToC rail.
  expect(await mainWidth(page)).toBeGreaterThan(896);
  expect(errors).toEqual([]);
});

test("the folder title and crossfilter-scale's own ToC label render off the static build", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${preview.url}nested/page`);
  const crumbs = page.getByRole("navigation", { name: "breadcrumb" });
  await expect(crumbs).toHaveText(
    /Orders overview\s*\/\s*Breakdowns\s*\/\s*Region detail/,
  );
  await expect(page.locator("details summary")).toHaveText("Breakdowns");

  await page.goto(`${preview.url}crossfilter-scale`);
  const measures = page.getByRole("navigation", { name: "Measures" });
  await expect(measures.getByRole("link")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("an unknown route renders the not-found page inside the app shell", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${preview.url}nope`);

  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Page not found");
  expect(errors).toEqual([]);
});
