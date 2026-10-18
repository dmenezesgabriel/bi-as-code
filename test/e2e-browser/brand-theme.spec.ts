import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { rewriteUntilServerLogs } from "../lib/write-until-logged.js";
import { effectiveBackground, paintedRgb, readRootToken } from "./contrast.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import {
  WEEKLY_REVIEW_CHART_COUNT,
  openWeeklyReviewCharts,
  optionAt,
  readyCharts,
} from "./echart-hosts.js";

const BRAND = {
  light: { primary: "#154886", background: "#fffdf5" },
  dark: { primary: "#60a5fa", background: "#0a0a0a" },
} as const;

const BRAND_BLOCK = `  brand: {
    colors: {
      primary: { light: "${BRAND.light.primary}", dark: "${BRAND.dark.primary}" },
      background: { light: "${BRAND.light.background}", dark: "${BRAND.dark.background}" },
    },
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

    test("brand colours in biac.config.ts restyle the chrome, the checked toggle and the chart surface", async ({
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
      expect(errors).toEqual([]);
    });
  });
}

test("a brand colour under its contrast floor is located in the overlay, and fixing it brings the page back", async ({
  page,
  biacDev,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWeeklyReviewCharts(page, biacDev.url);
  const configFile = join(biacDev.projectDir, "biac.config.ts");
  const shipped = readFileSync(configFile, "utf8");

  await rewriteConfig(
    configFile,
    brandedConfig(
      shipped,
      '  brand: { colors: { background: { light: "#fdf6e3", dark: "#0a0a0a" } } },\n',
    ),
    biacDev.log,
  );

  const overlay = page.locator("vite-error-overlay");
  await expect(overlay.locator(".message")).toContainText(
    "brand.colors.background.light: #fdf6e3 against --chart-4 #cc79a7 measures 2.83:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light",
    { timeout: 20_000 },
  );
  await expect(overlay.locator(".file")).toHaveText(/biac\.config\.ts:7:36$/);

  // Written once: the first edit after the error is the one that must
  // reload the tab, and a retry would hide an edit the server dropped.
  writeFileSync(configFile, shipped);
  await expect(readyCharts(page)).toHaveCount(WEEKLY_REVIEW_CHART_COUNT, {
    timeout: 20_000,
  });
  await expect(overlay).toHaveCount(0);
});
