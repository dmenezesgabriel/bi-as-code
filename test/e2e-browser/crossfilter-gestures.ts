import type { Page } from "@playwright/test";
import { expect, sliderThumbBox } from "./dev-server.fixture.js";
import { chartHosts, readyCharts, type PagePoint } from "./echart-hosts.js";
import {
  pageNow,
  abandonedQueries,
  readProbe,
  requestsAfterDisconnect,
  waitForSettled,
} from "./crossfilter-probe.js";

// Chart hosts in document order on /crossfilter-scale, by fence label.
export const SCALE_PAGE_CHARTS = ["delay", "distance", "time"] as const;
const CHARTS = SCALE_PAGE_CHARTS;
const ABANDON_ROUNDS = 6;

/** Opens /crossfilter-scale under `url` and waits for its charts to settle. */
export async function openScalePage(page: Page, url: string): Promise<void> {
  await page.goto(new URL("crossfilter-scale", url).href);
  await expect(readyCharts(page)).toHaveCount(CHARTS.length, {
    timeout: 30_000,
  });
  await waitForSettled(page);
}

/**
 * Leaves /crossfilter-scale mid-query `ABANDON_ROUNDS` times: each round
 * drags the slider, follows a sidebar link while the re-queries run, and
 * comes back. Needs `installCrossfilterProbe` before the first `goto`.
 *
 * @example
 * await abandonScalePageQueries(page, biacDev.url);
 * await expectAbandonedQueriesPostedNothingLate(page);
 */
export async function abandonScalePageQueries(
  page: Page,
  url: string,
): Promise<void> {
  await openScalePage(page, url);
  const track = {
    start: (await sliderThumbBox(page, "Minimum")).x,
    end: (await sliderThumbBox(page, "Maximum")).x,
  };
  for (let round = 0; round < ABANDON_ROUNDS; round++)
    await abandonSliderDrag(page, track, round % 2 === 0 ? 0.3 : 0.9);
  await waitForSettled(page);
}

/**
 * Asserts some query was abandoned — else the rest passes vacuously — that
 * nothing was posted for a connection after its `DISCONNECT`, and that no
 * cancel was posted: duckdb-wasm cannot cancel a prepared send, and a
 * cancelled poll makes its worker log the rejection.
 */
export async function expectAbandonedQueriesPostedNothingLate(
  page: Page,
): Promise<void> {
  const probe = await readProbe(page);
  expect(abandonedQueries(probe)).toBeGreaterThan(0);
  const late = requestsAfterDisconnect(probe.requests);
  expect(late.map((r) => r.type)).toEqual([]);
  const types = probe.requests.map((r) => r.type);
  expect(types).not.toContain("CANCEL_PENDING_QUERY");
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

/**
 * `steps` pointer moves from `from` to `to`, one every `frames` animation
 * frames — a paced drag the page's own clock times, not a fixed sleep.
 */
export async function drag(
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
