import type { Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectConsoleErrors,
  expect,
  instrumentWorkerPosts,
  resultTables,
  test,
  workerPosts,
} from "./dev-server.fixture.js";

/**
 * The `<BigValue>` root — a `span.block` containing the `text-xl` value
 * span; the title and delta rows are sibling `span.block`s without one.
 */
function kpi(page: Page) {
  return page
    .locator("span.block")
    .filter({ has: page.locator("span.text-xl") });
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
  await expect(widget.getByText("Quarter revenue")).toBeVisible({
    timeout: 30_000,
  });
  // SQL truth: sum(amount) over data/orders is 14600 → `usd` auto-scales
  // to `usd0k`.
  await expect(widget.locator("span.text-xl")).toHaveText("$15k");

  // wow_pct = 1430/1301 − 1 ≈ 0.099 → `pct1`; positive reads green with a
  // left-positioned arrow (aria-hidden — the signed text carries it).
  const delta = widget.locator('[data-status="positive"]');
  await expect(delta).toContainText("+9.9%");
  await expect(delta).toContainText("last week vs. prior");
  await expect(delta).toHaveClass(/text-emerald-/);
  await expect(delta.locator("svg")).toHaveCount(1);

  const spark = widget.locator('svg[aria-label="weekly_revenue"]');
  await expect(spark).toHaveCount(1);
  // 13 weekly rows → M plus 12 L segments in the stroked path.
  await expect(spark.locator("path")).toHaveAttribute(
    "d",
    /^M [\d.]+ [\d.]+( L [\d.]+ [\d.]+){12}$/,
  );

  // Five named fences each render a result table; the <Table> widget in
  // Quarter detail is the sixth live table.
  await expect(resultTables(page)).toHaveCount(6);

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
  await expect(sentence).toContainText("$15k", { timeout: 30_000 });
  await expect(sentence).toContainText("+9.9%");
  await expect(sentence).toContainText("WoW");
  await expect(sentence.locator('[data-status="positive"]')).toHaveCount(1);

  // index.md's inline <Value> binds `orders` row 0 — West, $6,100.
  await page.goto(biacDev.url);
  const lead = page.locator("p", {
    hasText: "The West leads on revenue at",
  });
  await expect(lead).toContainText("$6,100", { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test("standalone <Sparkline> renders the same series as a line and as bars", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  // Three `weekly_revenue` renderings total: the KPI's plus the two
  // standalone tags in the Trend lines paragraph.
  const series = page.locator('svg[aria-label="weekly_revenue"]');
  await expect(series).toHaveCount(3, { timeout: 30_000 });

  const prose = page.locator("p", { hasText: "Weekly revenue as a line" });
  const bars = prose.locator("svg:has(rect)");
  await expect(bars).toHaveCount(1);
  // One <rect> per point — the bar variant draws all 13 weeks.
  await expect(bars.locator("rect")).toHaveCount(13);
  await expect(prose.locator("svg:has(path)")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("?region=Atlantis empties the KPI to – and hides the delta and sparkline", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review?region=Atlantis`);

  // An empty filter result is not an error: the value reads – while the
  // delta and sparkline slots collapse instead of showing alerts.
  const widget = kpi(page);
  await expect(widget.locator("span.text-xl")).toHaveText("–", {
    timeout: 30_000,
  });
  await expect(widget.getByText("Quarter revenue")).toBeVisible();
  await expect(widget.locator("[data-status]")).toHaveCount(0);
  await expect(widget.locator("svg")).toHaveCount(0);

  // The prose scalars render – too, and the filtered-empty sparkline query
  // leaves no `weekly_revenue` svg anywhere on the page.
  const sentence = page.locator("p", {
    hasText: "Quarter revenue closed at",
  });
  await expect(sentence).toContainText("–");
  await expect(sentence.locator('[data-status="neutral"]')).toHaveCount(1);
  await expect(page.locator('svg[aria-label="weekly_revenue"]')).toHaveCount(0);
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

for (const { name, from, to, want } of BAD_REFS) {
  // Each `from` string's first occurrence sits on the <BigValue> tag — the
  // prose <Value>/<Delta> keep their working refs, so exactly one widget
  // alerts and the rest of the page stands.
  test(`${name} renders an inline alert without breaking the page`, async ({
    page,
    biacDev,
  }) => {
    const errors = collectConsoleErrors(page);
    const file = join(biacDev.projectDir, "pages/weekly-review.md");
    writeFileSync(file, readFileSync(file, "utf8").replace(from, to));
    await page.goto(`${biacDev.url}weekly-review`);

    const alert = page.getByRole("alert");
    await expect(alert).toHaveCount(1, { timeout: 30_000 });
    for (const text of want) await expect(alert).toContainText(text);
    await expect(
      page.getByRole("heading", { name: "Weekly review" }),
    ).toBeVisible();
    const sentence = page.locator("p", {
      hasText: "Quarter revenue closed at",
    });
    await expect(sentence).toContainText("$15k");
    await expect(sentence).toContainText("+9.9%");
    expect(errors).toEqual([]);
  });
}
