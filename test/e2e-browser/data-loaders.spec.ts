import type { Locator, Page } from "@playwright/test";
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
import {
  collectConsoleErrors,
  expect,
  resultTables,
  test,
} from "./dev-server.fixture.js";
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

/** One row of `data/orders.csv`, the input every example loader reads. */
interface OrderRow {
  week: string;
  date: string;
  region: string;
  amount: number;
}

/** `data/orders.csv`'s rows after the header. */
function readOrders(projectDir: string): OrderRow[] {
  return readFileSync(join(projectDir, "data/orders.csv"), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [, week = "", date = "", region = "", amount = ""] =
        line.split(",");
      return { week, date, region, amount: Number(amount) };
    });
}

/**
 * Week 1's row as the `<Table>` on /weekly-orders renders it, computed from
 * the loader's own input so the expectation never restates the loader.
 */
function firstWeekCells(projectDir: string): [string, string, string] {
  const rows = readOrders(projectDir).filter(({ week }) => week === "1");
  const revenue = rows.reduce((sum, { amount }) => sum + amount, 0);
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

/** How many times the dev log reports a run of the shipped loader. */
function weeklyLoaderRuns(log: readonly string[]): number {
  return log.filter((line) =>
    line.includes("data loader data/weekly-orders.csv.js →"),
  ).length;
}

test("editing a data loader refreshes the open page in place, through a failure and back", async ({
  page,
  biacDev,
}) => {
  // Arrange
  const errors = collectConsoleErrors(page);
  const loaderFile = join(biacDev.projectDir, "data/weekly-orders.csv.js");
  const original = readFileSync(loaderFile, "utf8");
  const [week, orders, revenue] = firstWeekCells(biacDev.projectDir);
  await expectWeeklyOrders(page, biacDev.url, biacDev.projectDir);
  await page.evaluate(() => ((window as { __mark?: number }).__mark = 1));
  const cells = page.locator("tbody tr").first().locator("td");
  const alerts = page.getByRole("alert");

  // Act: every order counts twice.
  writeFileSync(
    loaderFile,
    original.replace("total.orders + 1", "total.orders + 2"),
  );

  // Assert: the loader re-ran once and the table shows its new output.
  await expect(cells).toHaveText([week, String(2 * Number(orders)), revenue], {
    timeout: 15_000,
  });
  expect(weeklyLoaderRuns(biacDev.log())).toBe(2);

  // Act: the loader throws.
  writeFileSync(loaderFile, `throw new Error("boom");\n${original}`);

  // Assert: each call site shows the located loader failure.
  await expect(alerts).toHaveCount(3, { timeout: 15_000 });
  for (const alert of await alerts.all()) {
    await expect(alert).toContainText(
      "data loader data/weekly-orders.csv.js exited with code 1",
    );
    await expect(alert).toContainText("boom");
  }

  // Act: the loader is fixed.
  writeFileSync(loaderFile, original);

  // Assert: the original figures return, all without a reload.
  await expect(cells).toHaveText([week, orders, revenue], { timeout: 15_000 });
  await expect(alerts).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as { __mark?: number }).__mark),
  ).toBe(1);
  expect(errors).toEqual([
    "Failed to load resource: the server responded with a status of 500 (Internal Server Error)",
  ]);
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

/**
 * Each region's row as the regions `<Table>` on /regional-orders renders
 * it, alphabetical, computed from the loaders' input so the expectation
 * never restates the Python loader.
 */
function regionCells(projectDir: string): string[][] {
  const totals = new Map<string, { orders: number; revenue: number }>();
  for (const { region, amount } of readOrders(projectDir)) {
    const total = totals.get(region) ?? { orders: 0, revenue: 0 };
    totals.set(region, {
      orders: total.orders + 1,
      revenue: total.revenue + amount,
    });
  }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, { orders, revenue }]) => [
      region,
      String(orders),
      revenue.toLocaleString("en-US"),
    ]);
}

/**
 * The days the shell loader emits one row for, earliest first, each with
 * its order count — computed from the loader's input, like `regionCells`.
 */
function dayCells(projectDir: string): string[][] {
  const counts = new Map<string, number>();
  for (const { date } of readOrders(projectDir)) {
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, orders]) => [date, String(orders)]);
}

/** Asserts the Python loader's table shows one row per region. */
async function expectRegionTable(
  table: Locator,
  projectDir: string,
): Promise<void> {
  const expected = regionCells(projectDir);
  await expect(table.locator("tbody tr")).toHaveCount(expected.length);
  for (const [index, cells] of expected.entries()) {
    await expect(table.locator("tbody tr").nth(index).locator("td")).toHaveText(
      cells,
    );
  }
}

/** Asserts the shell loader's table pages through one row per day. */
async function expectDayTable(
  page: Page,
  table: Locator,
  projectDir: string,
): Promise<void> {
  const expected = dayCells(projectDir);
  const [firstDay] = expected;
  if (!firstDay)
    throw new Error(`data/orders.csv in ${projectDir} has no rows`);
  await expect(
    page.getByText(
      `Page 1 of ${Math.ceil(expected.length / 10)} · ${expected.length} rows`,
    ),
  ).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(10);
  await expect(table.locator("tbody tr").first().locator("td")).toHaveText(
    firstDay,
  );
}

/**
 * Opens /regional-orders and asserts both tables — one fed by a Python
 * loader, one by a shell loader — and both charts render.
 */
async function expectRegionalOrders(
  page: Page,
  baseUrl: string,
  projectDir: string,
): Promise<void> {
  await page.goto(`${baseUrl}regional-orders`);
  await expect(
    page.getByRole("heading", { name: "Regional orders" }),
  ).toBeVisible();
  await expectRegionTable(resultTables(page).nth(0), projectDir);
  await expectDayTable(page, resultTables(page).nth(1), projectDir);
  await expect(chartHosts(page)).toHaveCount(2);
}

/** How many times the dev log reports a run of `loader`. */
function loaderRuns(log: readonly string[], loader: string): number {
  return log.filter((line) => line.includes(`data loader ${loader} →`)).length;
}

test("a page queries Python and shell loaders' outputs on biac dev", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await expectRegionalOrders(page, biacDev.url, biacDev.projectDir);
  expect(loaderRuns(biacDev.log(), "data/region-revenue.csv.py")).toBe(1);
  expect(loaderRuns(biacDev.log(), "data/daily-orders.csv.sh")).toBe(1);
  expect(errors).toEqual([]);
});

test("biac dev serves Python and shell loaders' outputs and never their sources", async ({
  request,
  biacDev,
}) => {
  const output = await request.get(`${biacDev.url}data/region-revenue.csv`);
  expect(output.status()).toBe(200);
  expect(output.headers()["content-type"]).toContain("text/csv");
  expect(await output.text()).toMatch(/^region,orders,revenue\n/);
  for (const source of [
    "data/region-revenue.csv.py",
    "data/daily-orders.csv.sh",
  ]) {
    expect((await request.get(`${biacDev.url}${source}`)).status()).toBe(404);
  }
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

  test("the build ships every loader's output and no loader source", () => {
    const shipped = readdirSync(join(projectDir, "build/data"), {
      recursive: true,
    }).map(String);
    expect(shipped).toEqual(
      expect.arrayContaining([
        "weekly-orders.csv",
        "region-revenue.csv",
        "daily-orders.csv",
      ]),
    );
    expect(shipped.filter((name) => /\.(js|py|sh)$/.test(name))).toEqual([]);
  });

  test("the page renders the same figures off biac preview", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await expectWeeklyOrders(page, preview.url, projectDir);
    expect(errors).toEqual([]);
  });

  test("Python and shell loaders' outputs render off biac preview", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await expectRegionalOrders(page, preview.url, projectDir);
    expect(errors).toEqual([]);
  });
});
