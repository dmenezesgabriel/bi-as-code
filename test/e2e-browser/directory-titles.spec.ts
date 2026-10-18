import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { rewriteUntilServerLogs } from "../lib/write-until-logged.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

test("the shipped biac.config.ts titles pages/nested in the sidebar and breadcrumb, a config edit retitles it, and a stale key is located", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${biacDev.url}nested/page`);
  const heading = page.getByRole("heading", {
    level: 1,
    name: "Region detail",
  });
  await expect(heading).toBeVisible();
  const folder = page
    .getByRole("navigation", { name: "Site navigation" })
    .locator("details summary");
  await expect(folder).toHaveText("Breakdowns");
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toHaveText(
    /Orders overview\s*\/\s*Breakdowns\s*\/\s*Region detail/,
  );

  const configFile = join(biacDev.projectDir, "biac.config.ts");
  const shipped = readFileSync(configFile, "utf8");
  await rewriteUntilServerLogs({
    rewrite: () =>
      writeFileSync(configFile, shipped.replace('"Breakdowns"', '"Planning"')),
    log: biacDev.log,
    loggedPath: "biac.config.ts",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  await expect(folder).toHaveText("Planning", {
    timeout: 20_000,
  });
  await expect(page).toHaveURL(/\/nested\/page$/);
  expect(errors).toEqual([]);

  await rewriteUntilServerLogs({
    rewrite: () =>
      writeFileSync(
        configFile,
        shipped.replace('"pages/nested"', '"pages/nestd"'),
      ),
    log: biacDev.log,
    loggedPath: "biac.config.ts",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  // The config still loads, so the tab reloads itself into the app and vite
  // pushes the failed virtual:biac-pages load as its overlay; a reload of our
  // own would race that one and abort.
  const overlay = page.locator("vite-error-overlay");
  await expect(overlay.locator(".message")).toContainText(
    "directories.pages/nestd: unknown key, expected one of pages/nested (did you mean pages/nested?)",
    { timeout: 20_000 },
  );
  await expect(overlay.locator(".file")).toHaveText(/biac\.config\.ts:6:18$/);
  // The stale key's failed module request is the capability under test;
  // only the page the fix brings back must load cleanly.
  const errorsBeforeFix = errors.length;

  // Written once: the first edit after the error is the one that must
  // reload the tab, and a retry would hide an edit the server dropped.
  writeFileSync(configFile, shipped);
  await expect(heading).toBeVisible({ timeout: 20_000 });
  await expect(overlay).toHaveCount(0);
  await expect(folder).toHaveText("Breakdowns");
  expect(errors.slice(errorsBeforeFix)).toEqual([]);
});
