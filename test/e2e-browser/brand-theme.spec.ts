import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { rewriteUntilServerLogs } from "../lib/write-until-logged.js";
import { effectiveBackground, paintedRgb, readRootToken } from "./contrast.js";
import {
  type BiacDev,
  collectConsoleErrors,
  expect,
  test,
} from "./dev-server.fixture.js";
import { SCALE_PAGE_CHARTS } from "./crossfilter-gestures.js";
import {
  WEEKLY_REVIEW_CHART_COUNT,
  openWeeklyReviewCharts,
  optionAt,
  readyCharts,
} from "./echart-hosts.js";

// `defaultSeries2` is styles.css's `--chart-2`: a one-colour palette
// replaces series 1 only. A one-colour scale ramps from the background.
const BRAND = {
  light: {
    primary: "#154886",
    background: "#fffdf5",
    positive: "#047857",
    negative: "#b91c1c",
    field: "#f8fafc",
    sidebar: "#f1f5f9",
    series1: "#1e40af",
    defaultSeries2: "#d55e00",
    scaleEnd: "#172554",
  },
  dark: {
    primary: "#60a5fa",
    background: "#0a0a0a",
    positive: "#34d399",
    negative: "#f87171",
    field: "#1e293b",
    sidebar: "#0f172a",
    series1: "#60a5fa",
    defaultSeries2: "#e69f00",
    scaleEnd: "#93c5fd",
  },
} as const;

// The shipped config sets no brand; pages/crossfilter-scale.md's
// front-matter sets primary and series 1 for that page only.
const PROJECT_DEFAULT = {
  light: { primary: "#171717", series1: "#0072b2" },
  dark: { primary: "#e5e5e5", series1: "#0072b2" },
} as const;
const SCALE_PAGE_BRAND = {
  light: { primary: "#7c3aed", series1: "#7c3aed" },
  dark: { primary: "#c4b5fd", series1: "#c4b5fd" },
} as const;

const BRAND_BLOCK = `  brand: {
    colors: {
      primary: { light: "${BRAND.light.primary}", dark: "${BRAND.dark.primary}" },
      background: { light: "${BRAND.light.background}", dark: "${BRAND.dark.background}" },
      positive: { light: "${BRAND.light.positive}", dark: "${BRAND.dark.positive}" },
      negative: { light: "${BRAND.light.negative}", dark: "${BRAND.dark.negative}" },
      field: { light: "${BRAND.light.field}", dark: "${BRAND.dark.field}" },
      sidebar: { light: "${BRAND.light.sidebar}", dark: "${BRAND.dark.sidebar}" },
    },
    palette: { light: ["${BRAND.light.series1}"], dark: ["${BRAND.dark.series1}"] },
    scale: { light: ["${BRAND.light.scaleEnd}"], dark: ["${BRAND.dark.scaleEnd}"] },
    fonts: { body: "serif", heading: "sans-serif", code: "mono" },
    fontSize: "18px",
    radius: "12px",
  },
`;

// Tailwind's stacks by their first family, and the generic family that ends
// each: the brand names a stack, never a list.
const SERIF_STACK = /^ui-serif,.*\bserif$/;
const SANS_STACK = /^ui-sans-serif,.*\bsans-serif,/;
const MONO_STACK = /^ui-monospace,.*\bmonospace$/;

// The shipped config with a brand block added ahead of its closing brace.
function brandedConfig(shipped: string, block: string): string {
  return shipped.replace(/\n};\s*$/, `\n${block}};\n`);
}

async function rewriteConfig(
  configFile: string,
  source: string,
  log: () => readonly string[],
): Promise<void> {
  await rewriteUntilServerLogs({
    rewrite: () => writeFileSync(configFile, source),
    log,
    loggedPath: "biac.config.ts",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
}

// The weekly-review heatmap's ramp: it starts on the canvas surface the
// chart theme read from `--background` and ends on `--chart-scale`.
// The brand the document wears: `--primary`, series 1 of every ready chart,
// and how many page brand `<style>` elements are mounted under `#root`.
async function documentBrand(page: Page, chartCount: number) {
  const series1: (string | undefined)[] = [];
  for (let index = 0; index < chartCount; index += 1) {
    series1.push((await optionAt(page, index)).color?.[0]);
  }
  return {
    primary: await readRootToken(page, "--primary"),
    series1,
    pageStyles: await page.locator("#root style").count(),
  };
}

async function fontFamilyOf(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).fontFamily);
}

async function borderRadiusOf(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).borderRadius);
}

async function heatmapRamp(page: Page): Promise<readonly string[] | undefined> {
  for (let index = 0; index < WEEKLY_REVIEW_CHART_COUNT; index += 1) {
    const ramp = (await optionAt(page, index)).visualMap?.[0]?.inRange?.color;
    if (ramp) return ramp;
  }
  return undefined;
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test("brand colours, palette, scale and fonts in biac.config.ts restyle the chrome, the sidebar, the input surface, the checked toggle, the deltas, the text, the chart surface, series, heatmap ramp, chart text and corners", async ({
      page,
      biacDev,
    }) => {
      const errors = collectConsoleErrors(page);
      const brand = BRAND[colorScheme];
      await page.setViewportSize({ width: 1440, height: 900 });
      await openWeeklyReviewCharts(page, biacDev.url);
      const configFile = join(biacDev.projectDir, "biac.config.ts");

      // A config edit reloads the tab in full; read only after it lands.
      const reloaded = page.waitForEvent("load", { timeout: 20_000 });
      await rewriteConfig(
        configFile,
        brandedConfig(readFileSync(configFile, "utf8"), BRAND_BLOCK),
        biacDev.log,
      );
      await reloaded;
      await expect(readyCharts(page)).toHaveCount(WEEKLY_REVIEW_CHART_COUNT);

      expect(await readRootToken(page, "--primary")).toBe(brand.primary);
      expect(await readRootToken(page, "--background")).toBe(brand.background);
      expect(await readRootToken(page, "--positive")).toBe(brand.positive);
      expect(await readRootToken(page, "--negative")).toBe(brand.negative);
      const delta = page.getByText("+9.9%").first();
      expect(
        await paintedRgb(
          page,
          await delta.evaluate((element) => getComputedStyle(element).color),
        ),
      ).toEqual(await paintedRgb(page, brand.positive));
      expect(await readRootToken(page, "--field")).toBe(brand.field);
      expect(await readRootToken(page, "--sidebar")).toBe(brand.sidebar);
      const search = page.getByRole("textbox", { name: "Search regions" });
      expect(await paintedRgb(page, await effectiveBackground(search))).toEqual(
        await paintedRgb(page, brand.field),
      );
      const sidebar = page.getByRole("navigation", {
        name: "Site navigation",
      });
      expect(
        await paintedRgb(page, await effectiveBackground(sidebar)),
      ).toEqual(await paintedRgb(page, brand.sidebar));
      const toggle = page.getByRole("switch", { name: "Large orders only" });
      await toggle.click();
      await expect(toggle).toBeChecked();
      // Polled: the track's `transition-colors` eases into the fill.
      const brandFill = await paintedRgb(page, brand.primary);
      await expect
        .poll(async () =>
          paintedRgb(
            page,
            await toggle.evaluate(
              (element) => getComputedStyle(element).backgroundColor,
            ),
          ),
        )
        .toEqual(brandFill);
      const surface = await effectiveBackground(page.getByRole("main"));
      expect(await paintedRgb(page, surface)).toEqual(
        await paintedRgb(page, brand.background),
      );
      expect(await heatmapRamp(page)).toEqual([
        brand.background,
        brand.scaleEnd,
      ]);
      const palette = (await optionAt(page, 0)).color;
      expect(palette?.slice(0, 2)).toEqual([
        brand.series1,
        brand.defaultSeries2,
      ]);
      expect(await fontFamilyOf(page.locator("body"))).toMatch(SERIF_STACK);
      expect(await fontFamilyOf(page.locator("main h1"))).toMatch(SANS_STACK);
      expect(await fontFamilyOf(sidebar.getByRole("link").first())).toMatch(
        SANS_STACK,
      );
      expect(await fontFamilyOf(page.locator("main pre").first())).toMatch(
        MONO_STACK,
      );
      expect((await optionAt(page, 0)).textStyle?.fontFamily).toMatch(
        SERIF_STACK,
      );
      // 18px scales every rem: the 40rem reading measure stays 70ch.
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).fontSize,
        ),
      ).toBe("18px");
      expect(
        await page
          .locator("main p")
          .first()
          .evaluate((element) => getComputedStyle(element).maxWidth),
      ).toBe("720px");
      // A px radius ignores the root size; the md and sm steps derive from it.
      expect(await borderRadiusOf(search)).toBe("10px");
      expect(await borderRadiusOf(page.locator("main p a").first())).toBe(
        "8px",
      );
      expect(errors).toEqual([]);
    });
    test("pages/crossfilter-scale.md's front-matter brand applies to that page only, across client navigation both ways", async ({
      page,
      biacDev,
    }) => {
      const errors = collectConsoleErrors(page);
      const project = PROJECT_DEFAULT[colorScheme];
      const scalePage = SCALE_PAGE_BRAND[colorScheme];
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(biacDev.url);
      await expect(readyCharts(page)).toHaveCount(1);
      const sidebar = page.getByRole("navigation", { name: "Site navigation" });
      const projectBrand = {
        primary: project.primary,
        series1: [project.series1],
        pageStyles: 0,
      };
      expect(await documentBrand(page, 1)).toEqual(projectBrand);

      await sidebar
        .getByRole("link", { name: "Cross-filter at scale" })
        .click();
      await expect(readyCharts(page)).toHaveCount(SCALE_PAGE_CHARTS.length);
      expect(await documentBrand(page, SCALE_PAGE_CHARTS.length)).toEqual({
        primary: scalePage.primary,
        series1: SCALE_PAGE_CHARTS.map(() => scalePage.series1),
        pageStyles: 1,
      });
      const thumb = page.getByRole("slider", { name: "Minimum" }).locator("..");
      expect(
        await paintedRgb(
          page,
          await thumb.evaluate(
            (element) => getComputedStyle(element).borderTopColor,
          ),
        ),
      ).toEqual(await paintedRgb(page, scalePage.primary));

      await sidebar.getByRole("link", { name: "Orders overview" }).click();
      await expect(readyCharts(page)).toHaveCount(1);
      expect(await documentBrand(page, 1)).toEqual(projectBrand);
      expect(errors).toEqual([]);
    });
  });
}

// Writes `brandBlock` into the shipped config, expects the overlay to name
// `message` at `location`, then restores the file and expects the page back.
async function expectLocatedThenRecovered(
  page: Page,
  biacDev: BiacDev,
  brandBlock: string,
  failure: { message: string; location: RegExp },
): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWeeklyReviewCharts(page, biacDev.url);
  const configFile = join(biacDev.projectDir, "biac.config.ts");
  const shipped = readFileSync(configFile, "utf8");

  await rewriteConfig(
    configFile,
    brandedConfig(shipped, brandBlock),
    biacDev.log,
  );

  const overlay = page.locator("vite-error-overlay");
  await expect(overlay.locator(".message")).toContainText(failure.message, {
    timeout: 20_000,
  });
  await expect(overlay.locator(".file")).toHaveText(failure.location);

  // Written once: the first edit after the error is the one that must
  // reload the tab, and a retry would hide an edit the server dropped.
  writeFileSync(configFile, shipped);
  await expect(readyCharts(page)).toHaveCount(WEEKLY_REVIEW_CHART_COUNT, {
    timeout: 20_000,
  });
  await expect(overlay).toHaveCount(0);
}

const OVERLAY_FAILURES = [
  {
    what: "a brand colour under its contrast floor",
    brandLine:
      '  brand: { colors: { background: { light: "#fdf6e3", dark: "#0a0a0a" } } },\n',
    message:
      "brand.colors.background.light: #fdf6e3 against --chart-4 #cc79a7 measures 2.83:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light",
    location: /biac\.config\.ts:7:36$/,
  },
  {
    what: "a delta tone under its contrast floor",
    brandLine:
      '  brand: { colors: { positive: { light: "#4ade80", dark: "#34d399" } } },\n',
    message:
      "brand.colors.positive.light: #4ade80 against --background #ffffff measures 1.74:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.positive.light",
    location: /biac\.config\.ts:7:34$/,
  },
  {
    what: "a sidebar under its focus-ring floor",
    brandLine:
      '  brand: { colors: { sidebar: { light: "#cccccc", dark: "#171717" } } },\n',
    message:
      "brand.colors.sidebar.light: #cccccc against --ring #737373 measures 2.95:1, expected at least 3:1 (WCAG 2.2 SC 2.4.13) — change brand.colors.sidebar.light",
    location: /biac\.config\.ts:7:33$/,
  },
  {
    what: "a palette colour under its contrast floor",
    brandLine:
      '  brand: { palette: { light: ["#45a1bf"], dark: ["#60a5fa"] } },\n',
    message:
      "brand.palette.light[0]: #45a1bf against --background #ffffff measures 2.95:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.palette.light[0]",
    location: /biac\.config\.ts:7:31$/,
  },
  {
    what: "a font that is not a system stack's name",
    brandLine: '  brand: { fonts: { body: "comic" } },\n',
    message:
      'brand.fonts.body: expected one of "sans-serif", "serif", "mono", got "comic"',
    location: /biac\.config\.ts:7:21$/,
  },
  {
    what: "a corner radius past its cap",
    brandLine: '  brand: { radius: "2rem" },\n',
    message:
      'brand.radius: expected "0" or a "<n>px" or "<n>rem" length from 0 to 24px / 1.5rem, got "2rem"',
    location: /biac\.config\.ts:7:12$/,
  },
  {
    what: "a root font size out of range",
    brandLine: '  brand: { fontSize: "10px" },\n',
    message:
      'brand.fontSize: expected a "<n>px" size, n a whole number from 12 to 24, got "10px"',
    location: /biac\.config\.ts:7:12$/,
  },
  {
    what: "a scale with no colours",
    brandLine: "  brand: { scale: { light: [] } },\n",
    message:
      'brand.scale.light: expected an array of 1 or more "#rrggbb" colours, got []',
    location: /biac\.config\.ts:7:21$/,
  },
] as const;

for (const failure of OVERLAY_FAILURES) {
  test(`${failure.what} is located in the overlay, and fixing it brings the page back`, async ({
    page,
    biacDev,
  }) => {
    await expectLocatedThenRecovered(page, biacDev, failure.brandLine, failure);
  });
}
