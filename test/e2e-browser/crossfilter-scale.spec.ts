import type { Page, TestInfo } from "@playwright/test";
import {
  collectConsoleErrors,
  collectWorkerConsoleLines,
  expect,
  resultTables,
  sliderThumbBox,
  test,
} from "./dev-server.fixture.js";
import {
  chartHosts,
  chartPoint,
  optionAt,
  readyCharts,
  type PagePoint,
} from "./echart-hosts.js";
import {
  countPaints,
  installCrossfilterProbe,
  pageNow,
  readProbe,
  requestsAfterDisconnect,
  summarizeQueries,
  waitForSettled,
} from "./crossfilter-probe.js";

// Chart hosts in document order on /crossfilter-scale, by fence label.
const CHARTS = ["delay", "distance", "time"] as const;
const FLIGHTS = 200_000;
const ABANDON_ROUNDS = 6;

// chromium-headless-shell (the project default) crashes its renderer
// ("Target crashed") within ~4 slider publishes of 200k-row re-queries
// while the JS heap stays flat (~210 MB); Chrome's new headless — the build
// users run — completes the same 60-step drag. Reproduced 2026-10-09 with
// and without scripts/run-capped.sh.
test.use({ channel: "chromium" });

test.beforeEach(async ({ page }) => {
  await installCrossfilterProbe(page);
});

async function openScalePage(page: Page, url: string): Promise<void> {
  await page.goto(new URL("crossfilter-scale", url).href);
  await expect(readyCharts(page)).toHaveCount(CHARTS.length, {
    timeout: 30_000,
  });
  await waitForSettled(page);
}

/** Bar total per histogram — each bin's count summed. */
async function barTotals(page: Page): Promise<number[]> {
  const totals: number[] = [];
  for (const index of CHARTS.keys()) {
    const counts = (await optionAt(page, index)).series[0]?.data ?? [];
    totals.push(counts.reduce<number>((sum, c) => sum + Number(c), 0));
  }
  return totals;
}

/**
 * `steps` pointer moves from `from` to `to`, one every `frames` animation
 * frames — a paced drag the page's own clock times, not a fixed sleep.
 */
async function drag(
  page: Page,
  from: PagePoint,
  to: PagePoint,
  steps: number,
  frames: number,
): Promise<{ down: number; up: number }> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const down = await pageNow(page);
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    await page.mouse.move(
      from.x + (to.x - from.x) * k,
      from.y + (to.y - from.y) * k,
    );
    await page.evaluate(async (n) => {
      for (let f = 0; f < n; f++)
        await new Promise((resolve) => requestAnimationFrame(resolve));
    }, frames);
  }
  await page.mouse.up();
  return { down, up: await pageNow(page) };
}

/**
 * The gesture's measurements: queries per chart from press to settle,
 * paints per chart during the drag, and release → last paint. Attached
 * as JSON and logged as one structured line for before/after comparison.
 */
async function recordGesture(
  page: Page,
  testInfo: TestInfo,
  gesture: string,
  marks: { down: number; up: number },
) {
  await waitForSettled(page);
  const settled = await pageNow(page);
  const { requests, paints, publishes } = await readProbe(page);
  const afterRelease = paints.filter((p) => p.t > marks.up).map((p) => p.t);
  const report = {
    gesture,
    dragMs: Math.round(marks.up - marks.down),
    urlWrites: publishes.filter((t) => t >= marks.down && t <= marks.up).length,
    queries: summarizeQueries(requests, CHARTS, marks.down, settled),
    paintsDuringDrag: countPaints(paints, CHARTS, marks.down, marks.up),
    releaseToSettledMs: Math.round(
      Math.max(marks.up, ...afterRelease) - marks.up,
    ),
  };
  console.log(JSON.stringify({ event: "crossfilter-scale", ...report }));
  await testInfo.attach(`${gesture}.json`, {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  return report;
}

/**
 * Drags the slider's Maximum thumb to `fraction` of `track`, then leaves
 * the page while the re-queries that release started are still running,
 * and comes back.
 */
async function abandonSliderDrag(
  page: Page,
  track: { start: number; end: number },
  fraction: number,
): Promise<void> {
  const maximum = await sliderThumbBox(page, "Maximum");
  const y = maximum.y + maximum.height / 2;
  const from = { x: maximum.x + maximum.width / 2, y };
  const to = { x: track.start + (track.end - track.start) * fraction, y };
  await drag(page, from, to, 12, 0);
  await page.locator('nav a[href="/weekly-review"]').click();
  await page.goBack();
  await expect(chartHosts(page).locator("canvas")).toHaveCount(CHARTS.length, {
    timeout: 30_000,
  });
}

test("the helper fences render nothing while their histograms draw every row", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openScalePage(page, biacDev.url);

  // Named fences without `echo`/`display` still run and feed the slider
  // and histograms, but put neither code nor a result table on the page.
  expect(await barTotals(page)).toEqual([FLIGHTS, FLIGHTS, FLIGHTS]);
  await expect(page.locator("pre.shiki")).toHaveCount(0);
  await expect(resultTables(page)).toHaveCount(0);
  await expect(page.getByText(/^Page 1 of/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a slider drag over 200k rows settles every histogram on the released range", async ({
  page,
  biacDev,
}, testInfo) => {
  const errors = collectConsoleErrors(page);
  await openScalePage(page, biacDev.url);
  expect(await barTotals(page)).toEqual([FLIGHTS, FLIGHTS, FLIGHTS]);

  const minimum = await sliderThumbBox(page, "Minimum");
  const maximum = await sliderThumbBox(page, "Maximum");
  const y = maximum.y + maximum.height / 2;
  const from = { x: maximum.x + maximum.width / 2, y };
  const to = { x: minimum.x + (maximum.x - minimum.x) * 0.3, y };
  const marks = await drag(page, from, to, 60, 2);
  const report = await recordGesture(page, testInfo, "slider", marks);

  await expect(page).toHaveURL(/[?&]distance=/);
  // The slider is its own source, so no histogram is skipped: all three
  // read the same narrowed row set.
  const totals = await barTotals(page);
  expect(new Set(totals).size).toBe(1);
  expect(totals[0]).toBeGreaterThan(0);
  expect(totals[0]).toBeLessThan(FLIGHTS);
  // Latest-wins dispatch: a publish waits for the in-flight re-queries
  // instead of cancelling them, so every issued query completes.
  for (const label of CHARTS) {
    expect(report.queries[label]?.issued).toBeGreaterThan(0);
    expect(report.queries[label]?.cancelled).toBe(0);
  }
  expect(errors).toEqual([]);
});

test("a brush drag over 200k rows re-queries only the other histograms", async ({
  page,
  biacDev,
}, testInfo) => {
  const errors = collectConsoleErrors(page);
  await openScalePage(page, biacDev.url);
  await chartHosts(page).first().scrollIntoViewIfNeeded();

  // Brush the delay histogram from its first bin rightwards in steps, the
  // echarts brush's own 150 ms throttle pacing the publishes.
  const from = await chartPoint(page, 0, [0, 100]);
  const to = await chartPoint(page, 0, [12, 100]);
  const marks = await drag(page, from, to, 30, 2);
  const report = await recordGesture(page, testInfo, "brush", marks);

  // Cross-filter skip: the brushed chart keeps its rows and never re-queries.
  expect(report.queries.delay?.issued).toBe(0);
  expect(report.queries.distance?.issued).toBeGreaterThan(0);
  expect(report.queries.time?.issued).toBeGreaterThan(0);
  const [delay, distance, time] = await barTotals(page);
  expect(delay).toBe(FLIGHTS);
  expect(distance).toBe(time);
  expect(distance).toBeLessThan(FLIGHTS);
  expect(errors).toEqual([]);
});

test("leaving the page mid-query posts nothing for a disconnected connection", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const workerLines = collectWorkerConsoleLines(page);
  await openScalePage(page, biacDev.url);
  const track = {
    start: (await sliderThumbBox(page, "Minimum")).x,
    end: (await sliderThumbBox(page, "Maximum")).x,
  };

  for (let round = 0; round < ABANDON_ROUNDS; round++)
    await abandonSliderDrag(page, track, round % 2 === 0 ? 0.3 : 0.9);
  await waitForSettled(page);

  const { requests } = await readProbe(page);
  const abandoned = requests.filter((r) => r.type === "CANCEL_PENDING_QUERY");
  // Without an abandoned query the assertions below would pass vacuously.
  expect(abandoned.length).toBeGreaterThan(0);
  expect(requestsAfterDisconnect(requests).map((r) => r.type)).toEqual([]);
  expect(workerLines).toEqual([]);
  expect(errors).toEqual([]);
});
