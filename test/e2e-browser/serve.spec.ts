import { mkdtempSync, rmSync } from "node:fs";
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
  instrumentWorkerPosts,
  test,
  workerPosts,
} from "./dev-server.fixture.js";
import {
  chartHosts,
  chartPoint,
  expectScatterRegions,
  openWeeklyReviewCharts,
} from "./echart-hosts.js";

// `biac serve` over a real build/ behind HTTP basic auth. The browser sends
// credentials through the context's httpCredentials: a user:pass@ URL makes
// it refuse every fetch(), duckdb-wasm's included.

const USER = "viewer";
const PASSWORD = "s3cret";

test.describe("biac serve behind basic auth", () => {
  let projectDir: string;
  let server: DevServer;

  test.beforeAll(async () => {
    projectDir = mkdtempSync(join(tmpdir(), "biac-serve-browser-"));
    copyShippedProject(projectDir);
    buildProject(projectDir);
    server = await startBiacServer("serve", projectDir, {
      BIAC_BASIC_USER: USER,
      BIAC_BASIC_PASSWORD: PASSWORD,
      BIAC_AUTH_DISABLED: undefined,
    });
  });

  test.afterAll(async () => {
    await server.stop();
    rmSync(projectDir, { recursive: true, force: true });
  });

  test("a browser with no credentials is refused before any page loads", async ({
    page,
  }) => {
    const response = await page.goto(server.url);

    expect(response?.status()).toBe(401);
    expect(response?.headers()["www-authenticate"]).toContain("Basic");
  });

  test.describe("with credentials", () => {
    test.use({ httpCredentials: { username: USER, password: PASSWORD } });

    test("a deep link renders and its data files answer under auth", async ({
      page,
    }) => {
      const errors = collectConsoleErrors(page);
      const heading = page.getByRole("heading", { level: 1 });

      await page.goto(server.url);
      await expect(heading).toHaveText("Orders overview");

      await page.goto(`${server.url}weekly-review`);
      await expect(page).toHaveURL(/\/weekly-review\/$/);
      await expect(heading).toHaveText("Weekly review");

      expect(errors).toEqual([]);
    });

    test("a Regional split bar click re-queries under auth", async ({
      page,
    }) => {
      const errors = collectConsoleErrors(page);
      await instrumentWorkerPosts(page);
      await openWeeklyReviewCharts(page, server.url);

      // Every query is a worker post — the delta after the click is the
      // re-query; the scatter's West-only repaint is the round trip landing.
      await chartHosts(page).nth(0).scrollIntoViewIfNeeded();
      const postsBefore = await workerPosts(page);
      const west = await chartPoint(page, 0, [0, 3000]);
      await page.mouse.click(west.x, west.y);

      await expectScatterRegions(page, ["West"]);
      expect(await workerPosts(page)).toBeGreaterThan(postsBefore);
      expect(errors).toEqual([]);
    });
  });
});
