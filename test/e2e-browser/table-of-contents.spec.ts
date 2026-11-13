import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { rewriteUntilServerLogs } from "../lib/write-until-logged.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

test("crossfilter-scale names its own rail in front-matter and keeps it when biac.config.ts hides every other rail", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${biacDev.url}crossfilter-scale`);
  const measures = page.getByRole("navigation", { name: "Measures" });
  await expect(measures.getByText("Measures", { exact: true })).toBeVisible();
  await expect(measures.getByRole("link")).toHaveText([
    "Delay",
    "Distance",
    "Time",
  ]);

  const configFile = join(biacDev.projectDir, "biac.config.ts");
  const shipped = readFileSync(configFile, "utf8");
  // A config edit reloads the open tab by itself; a goto issued before that
  // reload lands is aborted by it, so navigate only after it has.
  const reloaded = page.waitForEvent("load", { timeout: 20_000 });
  await rewriteUntilServerLogs({
    rewrite: () =>
      writeFileSync(
        configFile,
        shipped.replace("{\n", "{\n  layout: { table_of_contents: false },\n"),
      ),
    log: biacDev.log,
    loggedPath: "biac.config.ts",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  await reloaded;
  await page.goto(`${biacDev.url}weekly-review`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Weekly review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "On this page" }),
  ).toHaveCount(0);

  await page.goto(`${biacDev.url}crossfilter-scale`);
  await expect(measures.getByRole("link")).toHaveCount(3);
  expect(errors).toEqual([]);
});
