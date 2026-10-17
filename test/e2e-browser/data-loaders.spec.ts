import type { Page } from "@playwright/test";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildProject,
  startBiacServer,
  type DevServer,
} from "../lib/dev-server.js";
import { copyShippedProject } from "../lib/shipped-project.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { chartHosts } from "./echart-hosts.js";

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

/**
 * Week 1's row as the `<Table>` on /weekly-orders renders it, computed from
 * the loader's own input so the expectation never restates the loader.
 */
function firstWeekCells(projectDir: string): string[] {
  const rows = readFileSync(join(projectDir, "data/orders.csv"), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.split(","))
    .filter(([, week]) => week === "1");
  const revenue = rows.reduce((sum, row) => sum + Number(row[4]), 0);
  return ["1", String(rows.length), revenue.toLocaleString("en-US")];
}

/** Opens /weekly-orders and asserts the loader-fed table and chart render. */
async function expectWeeklyOrders(
  page: Page,
  baseUrl: string,
  projectDir: string,
): Promise<void> {
  await page.goto(`${baseUrl}weekly-orders`);
  await expect(
    page.getByRole("heading", { name: "Weekly orders" }),
  ).toBeVisible();
  await expect(page.getByText("Page 1 of 2 · 13 rows")).toBeVisible();
  const cells = page.locator("tbody tr").first().locator("td");
  await expect(cells).toHaveText(firstWeekCells(projectDir));
  await expect(chartHosts(page)).toHaveCount(1);
}

test("a page queries a data loader's output on biac dev", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await expectWeeklyOrders(page, biacDev.url, biacDev.projectDir);
  expect(errors).toEqual([]);
});

test("biac dev serves the loader's output and never its source", async ({
  request,
  biacDev,
}) => {
  const output = await request.get(`${biacDev.url}data/weekly-orders.csv`);
  expect(output.status()).toBe(200);
  expect(output.headers()["content-type"]).toContain("text/csv");
  expect(await output.text()).toMatch(/^week,orders,revenue\n1,/);
  const source = await request.get(`${biacDev.url}data/weekly-orders.csv.js`);
  expect(source.status()).toBe(404);
});

test.describe("off the static build", () => {
  let projectDir: string;
  let preview: DevServer;

  test.beforeAll(async () => {
    projectDir = mkdtempSync(join(tmpdir(), "biac-loader-build-"));
    copyShippedProject(projectDir);
    buildProject(projectDir);
    preview = await startBiacServer("preview", projectDir);
  });

  test.afterAll(async () => {
    await preview.stop();
    rmSync(projectDir, { recursive: true, force: true });
  });

  test("the build ships the loader's output and no loader source", () => {
    const shipped = readdirSync(join(projectDir, "build/data"), {
      recursive: true,
    }).map(String);
    expect(shipped).toContain("weekly-orders.csv");
    expect(shipped.filter((name) => name.endsWith(".js"))).toEqual([]);
  });

  test("the page renders the same figures off biac preview", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await expectWeeklyOrders(page, preview.url, projectDir);
    expect(errors).toEqual([]);
  });
});
