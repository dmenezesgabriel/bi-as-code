import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { rewriteUntilServerLogs } from "../lib/write-until-logged.js";
import { effectiveBackground, paintedRgb, readRootToken } from "./contrast.js";
import {
  type BiacDev,
  collectConsoleErrors,
  expect,
  test,
} from "./dev-server.fixture.js";
import {
  WEEKLY_REVIEW_CHART_COUNT,
  openWeeklyReviewCharts,
  optionAt,
  readyCharts,
} from "./echart-hosts.js";

// `defaultSeries2` is styles.css's `--chart-2`: a one-colour palette
// replaces series 1 only.
const BRAND = {
  light: {
    primary: "#154886",
    background: "#fffdf5",
    series1: "#1e40af",
    defaultSeries2: "#d55e00",
  },
  dark: {
    primary: "#60a5fa",
    background: "#0a0a0a",
    series1: "#60a5fa",
    defaultSeries2: "#e69f00",
  },
} as const;

const BRAND_BLOCK = `  brand: {
    colors: {
      primary: { light: "${BRAND.light.primary}", dark: "${BRAND.dark.primary}" },
      background: { light: "${BRAND.light.background}", dark: "${BRAND.dark.background}" },
    },
    palette: { light: ["${BRAND.light.series1}"], dark: ["${BRAND.dark.series1}"] },
  },
`;

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

// The first colour of the weekly-review heatmap's ramp: the canvas surface
// the chart theme read from `--background`.
async function heatmapRampStart(page: Page): Promise<string | undefined> {
  for (let index = 0; index < WEEKLY_REVIEW_CHART_COUNT; index += 1) {
    const ramp = (await optionAt(page, index)).visualMap?.[0]?.inRange?.color;
    if (ramp) return ramp[0];
  }
  return undefined;
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test("brand colours and palette in biac.config.ts restyle the chrome, the checked toggle, the chart surface and series", async ({
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
      expect(await heatmapRampStart(page)).toBe(brand.background);
      const palette = (await optionAt(page, 0)).color;
      expect(palette?.slice(0, 2)).toEqual([
        brand.series1,
        brand.defaultSeries2,
      ]);
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

test("a brand colour under its contrast floor is located in the overlay, and fixing it brings the page back", async ({
  page,
  biacDev,
}) => {
  await expectLocatedThenRecovered(
    page,
    biacDev,
    '  brand: { colors: { background: { light: "#fdf6e3", dark: "#0a0a0a" } } },\n',
    {
      message:
        "brand.colors.background.light: #fdf6e3 against --chart-4 #cc79a7 measures 2.83:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light",
      location: /biac\.config\.ts:7:36$/,
    },
  );
});

test("a palette colour under its contrast floor is located in the overlay, and fixing it brings the page back", async ({
  page,
  biacDev,
}) => {
  await expectLocatedThenRecovered(
    page,
    biacDev,
    '  brand: { palette: { light: ["#45a1bf"], dark: ["#60a5fa"] } },\n',
    {
      message:
        "brand.palette.light[0]: #45a1bf against --background #ffffff measures 2.95:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.palette.light[0]",
      location: /biac\.config\.ts:7:31$/,
    },
  );
});
