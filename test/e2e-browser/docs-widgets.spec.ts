import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expect,
  resultTables,
  test,
} from "./dev-server.fixture.js";
import {
  chartHosts,
  optionAt,
  paintedTexts,
  readyCharts,
  type PaintedText,
} from "./echart-hosts.js";
import { expectProbes, TOKENS } from "./theme-probes.js";

test.use({ biacProject: "docs", viewport: { width: 375, height: 812 } });

/**
 * One widget reference page: the tags its `mdx echo` fences use, and the
 * live element each one draws, so every example's output is counted
 * against the markup that should have drawn it.
 */
interface WidgetPage {
  readonly route: string;
  readonly file: string;
  readonly drawn: readonly {
    readonly tag: RegExp;
    readonly live: (page: Page) => Locator;
  }[];
}

const sparklines = (page: Page) => page.locator("main svg[role=img]");
// echarts marks its host once the applied option has finished painting.
const charts = (page: Page) => page.locator("main [data-echarts-ready]");

const WIDGET_PAGES: readonly WidgetPage[] = [
  {
    route: "/components/table",
    file: "pages/components/table.md",
    drawn: [{ tag: /<Table\b/g, live: resultTables }],
  },
  {
    route: "/components/big-value",
    file: "pages/components/big-value.md",
    drawn: [
      // The value line's `text-xl` span is the one mark every BigValue draws.
      {
        tag: /<BigValue\b/g,
        live: (page) => page.locator("main span.text-xl"),
      },
    ],
  },
  {
    route: "/components/value",
    file: "pages/components/value.md",
    drawn: [
      { tag: /<Delta\b/g, live: (page) => page.locator("main [data-status]") },
      { tag: /<Sparkline\b/g, live: sparklines },
    ],
  },
  {
    route: "/components/bar-chart",
    file: "pages/components/bar-chart.md",
    drawn: [{ tag: /<BarChart\b/g, live: charts }],
  },
  {
    route: "/components/line-chart",
    file: "pages/components/line-chart.md",
    drawn: [{ tag: /<LineChart\b/g, live: charts }],
  },
  {
    route: "/components/area-chart",
    file: "pages/components/area-chart.md",
    drawn: [{ tag: /<AreaChart\b/g, live: charts }],
  },
  {
    route: "/components/scatter-chart",
    file: "pages/components/scatter-chart.md",
    drawn: [{ tag: /<ScatterChart\b/g, live: charts }],
  },
  {
    route: "/components/histogram",
    file: "pages/components/histogram.md",
    // The cross-filter example pairs the histograms with a bar chart, and
    // both draw the same echarts host.
    drawn: [{ tag: /<(?:Histogram|BarChart)\b/g, live: charts }],
  },
  {
    route: "/components/heatmap",
    file: "pages/components/heatmap.md",
    drawn: [{ tag: /<Heatmap\b/g, live: charts }],
  },
];

/** How many times `tag` appears inside the page file's `mdx echo` fences. */
function echoedTagCount(source: string, tag: RegExp): number {
  const fences = source.matchAll(/^```mdx echo\n([\s\S]*?)^```$/gm);
  return [...fences].reduce(
    (sum, [, body]) => sum + (body!.match(tag)?.length ?? 0),
    0,
  );
}

const SERIES_CHART_ROUTES = [
  "/components/bar-chart",
  "/components/line-chart",
  "/components/area-chart",
];

/** Indexes of the ready chart hosts whose x axis is a time axis. */
async function timeAxisHosts(page: Page): Promise<number[]> {
  await expect(charts(page).first()).toBeVisible();
  const count = await chartHosts(page).count();
  await expect(readyCharts(page)).toHaveCount(count);
  const indexes = Array.from({ length: count }, (_, i) => i);
  const types = await Promise.all(
    indexes.map(async (i) => (await optionAt(page, i)).xAxis[0]?.type),
  );
  return indexes.filter((i) => types[i] === "time");
}

/**
 * The painted x-axis labels of chart host `host`, left to right: the texts
 * whose box starts under the plot's bottom edge, the x title left out. The
 * value axis' `0` is centred on that edge, so it starts above it.
 */
async function xAxisLabelBoxes(
  page: Page,
  host: number,
): Promise<PaintedText[]> {
  const { texts } = await paintedTexts(page, host);
  const { plotBottom, xTitle } = await xAxisFrame(page, host);
  return texts
    .filter((t) => t.y >= plotBottom && t.text !== xTitle)
    .sort((a, b) => a.x - b.x);
}

/** Chart host `host`'s plot bottom edge (host px) and its x title, if any. */
function xAxisFrame(
  page: Page,
  host: number,
): Promise<{ plotBottom: number; xTitle?: string }> {
  return page.evaluate((hi) => {
    const el = document.querySelectorAll<HTMLElement>("[data-echarts-theme]")[
      hi
    ];
    const chart = (el as unknown as { echartsInstance?: FramedChart })
      .echartsInstance;
    if (!chart) throw new Error(`chart host ${hi} has no echartsInstance`);
    const plot = chart.getModel().getComponent("grid", 0).coordinateSystem;
    const { y, height } = plot.getRect();
    return { plotBottom: y + height, xTitle: chart.getOption().xAxis[0]?.name };
  }, host);
}

/** The live-instance surface `xAxisFrame` reads the plot rect through. */
interface FramedChart {
  getOption(): { xAxis: { name?: string }[] };
  getModel(): {
    getComponent(
      type: "grid",
      index: 0,
    ): { coordinateSystem: { getRect(): { y: number; height: number } } };
  };
}

/**
 * Every pair of `labels` whose boxes share pixels — an x title painted in
 * the same band sits on its own row, so only a box that meets another in
 * both directions counts.
 */
function overlaps(labels: readonly PaintedText[]): string[] {
  return labels.flatMap((a, i) =>
    labels
      .slice(i + 1)
      .filter((b) => boxesMeet(a, b))
      .map((b) => `${a.text} | ${b.text}`),
  );
}

function boxesMeet(a: PaintedText, b: PaintedText): boolean {
  const apartX = a.x + a.width <= b.x || b.x + b.width <= a.x;
  const apartY = a.y + a.height <= b.y || b.y + b.height <= a.y;
  return !apartX && !apartY;
}

function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode at 375 px`, () => {
    test.use({ colorScheme });

    for (const { route, file, drawn } of WIDGET_PAGES) {
      test(`${route} draws every echoed example without an alert or a sideways scroll`, async ({
        page,
        biacDev,
      }) => {
        const errors = collectConsoleErrors(page);
        const source = readFileSync(join(biacDev.projectDir, file), "utf8");

        await page.goto(`${biacDev.url}${route}`);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator("main [role=status]")).toHaveCount(0);

        for (const { tag, live } of drawn) {
          const echoed = echoedTagCount(source, tag);
          expect(echoed, `${tag} in ${file}`).toBeGreaterThan(0);
          await expect(live(page)).toHaveCount(echoed);
        }
        await expect(page.locator("main [role=alert]")).toHaveCount(0);
        expect(await pageOverflow(page)).toBe(0);
        await expectProbes(
          page,
          [
            {
              name: "body text",
              locate: (p) => p.locator("main > p").first(),
              property: "color",
              token: "--foreground",
            },
          ],
          TOKENS[colorScheme],
        );
        expect(errors).toEqual([]);
      });
    }

    test.describe("west of Greenwich", () => {
      // A DATE cell is midnight UTC; read on this clock it would be the
      // evening of the day before.
      test.use({ timezoneId: "America/Los_Angeles" });

      test("a date column shows the day the query returned", async ({
        page,
        biacDev,
      }) => {
        const errors = collectConsoleErrors(page);
        await page.goto(`${biacDev.url}/components/table`);

        const wettest = page.getByRole("table").filter({
          has: page.getByRole("columnheader", { name: "Day" }),
        });

        await expect(wettest.getByRole("row").nth(1)).toContainText(
          "March 15, 2015",
        );
        expect(errors).toEqual([]);
      });
    });

    for (const width of [375, 1280]) {
      test(`every time axis on the series chart pages paints its x labels apart at ${width} px`, async ({
        page,
        biacDev,
      }) => {
        const errors = collectConsoleErrors(page);
        await page.setViewportSize({ width, height: 812 });

        for (const route of SERIES_CHART_ROUTES) {
          await page.goto(`${biacDev.url}${route}`);
          await expect(page.locator("main [role=status]")).toHaveCount(0);
          const hosts = await timeAxisHosts(page);
          expect(hosts.length, `time axes on ${route}`).toBeGreaterThan(0);
          for (const host of hosts) {
            const labels = await xAxisLabelBoxes(page, host);
            expect(labels.length, `${route} chart ${host}`).toBeGreaterThan(1);
            expect(overlaps(labels), `${route} chart ${host}`).toEqual([]);
          }
        }
        expect(errors).toEqual([]);
      });
    }

    test("a sparkline paints in the theme's sparkline colour", async ({
      page,
      biacDev,
    }) => {
      const errors = collectConsoleErrors(page);
      await page.goto(`${biacDev.url}/components/value`);

      await expect(sparklines(page).first()).toBeVisible();
      await expectProbes(
        page,
        [
          {
            name: "sparkline stroke",
            locate: (p) => sparklines(p).first(),
            property: "color",
            token: "--sparkline",
          },
        ],
        TOKENS[colorScheme],
      );
      expect(errors).toEqual([]);
    });
  });
}
