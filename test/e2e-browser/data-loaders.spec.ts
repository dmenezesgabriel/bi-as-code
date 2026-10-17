import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

const FAILING_LOADER = `process.stderr.write("upstream timed out\\n");
process.exit(3);
`;

test("a failing data loader shows inline errors naming it and its exit code", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const indexFile = join(biacDev.projectDir, "pages/index.md");
  writeFileSync(
    join(biacDev.projectDir, "data/broken.parquet.js"),
    FAILING_LOADER,
  );
  writeFileSync(
    indexFile,
    readFileSync(indexFile, "utf8").replace(
      "data/orders.parquet",
      "data/broken.parquet",
    ),
  );
  await page.goto(biacDev.url);

  // Every call site of the `orders` result — fence table, `<Table>`,
  // `<Value>`, `<BarChart>` — carries the loader's own failure, read from
  // the dev server's plain-text 500, while the rest of the page renders.
  const alerts = page.getByRole("alert");
  await expect(alerts).toHaveCount(4);
  for (const alert of await alerts.all()) {
    await expect(alert).toContainText(
      "data loader data/broken.parquet.js exited with code 3",
    );
    await expect(alert).toContainText("upstream timed out");
  }
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();
  // The one line is Chromium's own report of the diagnostic GET that reads
  // the 500's body; the app logs nothing.
  expect(errors).toEqual([
    "Failed to load resource: the server responded with a status of 500 (Internal Server Error)",
  ]);
});
