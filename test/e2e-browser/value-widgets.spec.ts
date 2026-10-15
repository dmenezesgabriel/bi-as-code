import type { Page } from "@playwright/test";
import { contrastRatio, effectiveBackground } from "./contrast.js";
import {
  collectConsoleErrors,
  expect,
  instrumentWorkerPosts,
  resultTables,
  test,
  testBadRefs,
  workerPosts,
} from "./dev-server.fixture.js";

/**
 * The `<BigValue>` root — a `span.block` containing the `text-xl` value
 * span; the title and delta rows are sibling `span.block`s without one.
 * Scoped to the Revenue KPI: the Overview `<Row>` holds three BigValues.
 */
function kpi(page: Page) {
  return page
    .locator("span.block")
    .filter({ has: page.locator("span.text-xl") })
    .filter({ has: page.getByText("Quarter revenue", { exact: true }) });
}

test.beforeEach(async ({ page }) => {
  // The widgets bind the query registry — every worker post after first
  // render would mean a re-query leaked in.
  await instrumentWorkerPosts(page);
});

test("weekly-review's <BigValue> renders title, $15k scalar, green delta, 13-point sparkline", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const widget = kpi(page);
  await expect(widget.getByText("Quarter revenue")).toBeVisible();
  // SQL truth: sum(amount) over data/orders is 14600 → `usd` auto-scales
  // to `usd0k`.
  await expect(widget.locator("span.text-xl")).toHaveText("$15k");

  // wow_pct = 1430/1301 − 1 ≈ 0.099 → `pct1`; positive reads green with a
  // left-positioned arrow (aria-hidden — the signed text carries it).
  const delta = widget.locator('[data-status="positive"]');
  await expect(delta).toContainText("+9.9%");
  await expect(delta).toContainText("last week vs. prior");
  await expect(delta).toHaveClass(/text-positive/);
  await expect(delta.locator("svg")).toHaveCount(1);

  const spark = widget.locator('svg[aria-label="weekly_revenue"]');
  await expect(spark).toHaveCount(1);
  // 13 weekly rows → M plus 12 L segments in the stroked path.
  await expect(spark.locator("path")).toHaveAttribute(
    "d",
    /^M [\d.]+ [\d.]+( L [\d.]+ [\d.]+){12}$/,
  );

  // Only region_share opts its fence into `display`; with the <Table>
  // widgets in the Order-mix tabs, under order_detail and in Quarter detail
  // that makes four live tables.
  await expect(resultTables(page)).toHaveCount(4);

  // Rendering is registry reads — nothing posts to the duckdb worker
  // after the results settle.
  const posts = await workerPosts(page);
  expect(await workerPosts(page)).toBe(posts);
  expect(errors).toEqual([]);
});

test("<Value> and <Delta> render formatted scalars inside prose", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const sentence = page.locator("p", {
    hasText: "Quarter revenue closed at",
  });
  await expect(sentence).toContainText("$15k");
  await expect(sentence).toContainText("+9.9%");
  await expect(sentence).toContainText("WoW");
  await expect(sentence.locator('[data-status="positive"]')).toHaveCount(1);

  // index.md's inline <Value> binds `orders` row 0 — West, $6,100.
  await page.goto(biacDev.url);
  const lead = page.locator("p", {
    hasText: "The West leads on revenue at",
  });
  await expect(lead).toContainText("$6,100");
  expect(errors).toEqual([]);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`every ${colorScheme} delta reads at text contrast on its background`, async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.emulateMedia({ colorScheme });
    await page.goto(`${biacDev.url}weekly-review`);
    // The Quarter revenue <BigValue> chip and the inline prose <Delta>.
    const deltas = page.locator("main span[data-status]");
    await expect(deltas).toHaveCount(2);

    const ratios: number[] = [];
    for (const delta of await deltas.all()) {
      const text = await delta.evaluate((el) => getComputedStyle(el).color);
      const background = await effectiveBackground(delta);
      ratios.push(await contrastRatio(page, text, background));
    }

    // WCAG 1.4.3: body-size text needs 4.5:1, a chip's tint included.
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(errors).toEqual([]);
  });
}

test("standalone <Sparkline> renders the same series as a line and as bars", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  // Three `weekly_revenue` renderings total: the KPI's plus the two
  // standalone tags in the Trend lines paragraph.
  const series = page.locator('svg[aria-label="weekly_revenue"]');
  await expect(series).toHaveCount(3);

  const prose = page.locator("p", { hasText: "Weekly revenue as a line" });
  const bars = prose.locator("svg:has(rect)");
  await expect(bars).toHaveCount(1);
  // One <rect> per point — the bar variant draws all 13 weeks.
  await expect(bars.locator("rect")).toHaveCount(13);
  await expect(prose.locator("svg:has(path)")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("?region=Atlantis is pruned by the Region dropdown so the KPI renders unfiltered", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review?region=Atlantis`);

  // Atlantis is not a region option: the dropdown drops the stale param
  // once its options load, so the KPI renders the full-quarter read with
  // its delta and sparkline — not the empty face.
  const widget = kpi(page);
  await expect(widget.locator("span.text-xl")).toHaveText("$15k");
  await expect(page).toHaveURL(/weekly-review$/);
  await expect(widget.getByText("Quarter revenue")).toBeVisible();
  await expect(widget.locator('[data-status="positive"]')).toContainText("+");
  await expect(page.locator('svg[aria-label="weekly_revenue"]')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("?region=West narrows the KPI through its fences' raw param surface", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review?region=West`);

  // The KPI's fences still interpolate {{params.region}} — sum(amount) over
  // the West weeks is 6100, `usd` auto-scaling to `usd0k`, with the West
  // WoW delta and its sparkline intact.
  const widget = kpi(page);
  await expect(widget.locator("span.text-xl")).toHaveText("$6k");
  await expect(widget.locator('[data-status="positive"]')).toContainText(
    "+15.7%",
  );
  await expect(widget.locator('svg[aria-label="weekly_revenue"]')).toHaveCount(
    1,
  );
  expect(errors).toEqual([]);
});

const BAD_REFS = [
  {
    name: "an undeclared data name",
    from: 'data="kpi"',
    to: 'data="ghost_query"',
    want: ["ghost_query", "no sql fence on this page declares this name"],
  },
  {
    name: "an unknown column",
    from: 'column="revenue"',
    to: 'column="sales"',
    want: ['column "sales" is not in the result', "revenue, orders, wow_pct"],
  },
  {
    name: "an unsupported fmt code",
    from: 'fmt="usd"',
    to: 'fmt="bogus"',
    want: ['fmt="bogus"', "unknown format code"],
  },
] as const;

// Each `from` string's first occurrence sits on the <BigValue> tag — the
// prose <Value>/<Delta> keep their working refs, so exactly one widget
// alerts and the rest of the page stands.
testBadRefs(
  "weekly-review",
  "pages/weekly-review.md",
  BAD_REFS,
  async (page) => {
    await expect(
      page.getByRole("heading", { name: "Weekly review" }),
    ).toBeVisible();
    const sentence = page.locator("p", {
      hasText: "Quarter revenue closed at",
    });
    await expect(sentence).toContainText("$15k");
    await expect(sentence).toContainText("+9.9%");
  },
);
