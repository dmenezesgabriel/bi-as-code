import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "../lib/dev-server.js";
import { servePrefixed } from "../lib/prefixed-host.js";
import { copyShippedProject } from "../lib/shipped-project.js";
import { serveStaticDir, type StaticDir } from "../lib/static-server.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import {
  expectCrossfilterRequery,
  openWeeklyReviewCharts,
} from "./echart-hosts.js";
import { WIDGET_HOST_PAGE } from "./host-page.js";

// The build/ folder on a plain static host: directory URLs answer their own
// index.html and nothing else rewrites — S3 website endpoints, GitHub Pages
// and python3 -m http.server all behave like serveStaticDir. The two builds
// (default base, then base "/bi-as-code/") prove deep links and prefixed
// deploys survive a host that cannot fall back to the shell.

test.describe("the build on a host with no rewrite rules", () => {
  let projectDir: string;
  let staticHost: StaticDir;

  test.beforeAll(async () => {
    projectDir = mkdtempSync(join(tmpdir(), "biac-static-host-"));
    copyShippedProject(projectDir);
    buildProject(projectDir);
    staticHost = await serveStaticDir(join(projectDir, "build"));
  });

  test.afterAll(async () => {
    await staticHost.close();
    rmSync(projectDir, { recursive: true, force: true });
  });

  test("a deep link renders with no rewrite rule", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const heading = page.getByRole("heading", { level: 1 });

    await page.goto(`${staticHost.url}/`);
    await expect(heading).toHaveText("Orders overview");

    // The host 301s to the trailing slash and the route's own index.html
    // answers — the SPA fallback this proves absent is nowhere to find.
    await page.goto(`${staticHost.url}/weekly-review`);
    await expect(page).toHaveURL(/\/weekly-review\/$/);
    await expect(heading).toHaveText("Weekly review");

    // One level down the copied shell's root-absolute asset refs still hold.
    await page.goto(`${staticHost.url}/nested/allocation`);
    await expect(heading).toHaveText("Allocation");

    expect(errors).toEqual([]);
  });

  test("the URLs the app writes answer 200 when reloaded or opened", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    const heading = page.getByRole("heading", { level: 1 });

    // A filtered page keeps its directory URL: a slash-less rewrite of it
    // would reload into this host's 404.
    const filtered = `${staticHost.url}/weekly-review/?region=West`;
    expect((await page.goto(filtered))?.status()).toBe(200);
    await expect(heading).toHaveText("Weekly review");
    await expect(page).toHaveURL(filtered);
    expect((await page.reload())?.status()).toBe(200);
    await expect(page).toHaveURL(filtered);

    // A nav link copied out of the sidebar opens straight off the host.
    const nav = page.getByRole("navigation", { name: "Site navigation" });
    await nav.getByText("Breakdowns").click();
    const href = await nav
      .getByRole("link", { name: "Allocation" })
      .getAttribute("href");
    expect(href).toBe("/nested/allocation/");
    expect((await page.goto(`${staticHost.url}${href}`))?.status()).toBe(200);
    await expect(heading).toHaveText("Allocation");

    expect(errors).toEqual([]);
  });

  test("a Regional split bar click cross-filters weekly-review off a rewrite-less host", async ({
    page,
  }) => {
    await expectCrossfilterRequery(page, `${staticHost.url}/`);
  });
});

test.describe("the build under a configured base", () => {
  const BASE = "/bi-as-code/";
  let projectDir: string;
  let staticHost: StaticDir;

  test.beforeAll(async () => {
    projectDir = mkdtempSync(join(tmpdir(), "biac-static-base-"));
    copyShippedProject(projectDir);
    // base is baked at build — vite emits asset URLs beneath it — so the
    // config names it before buildProject.
    const config = readFileSync(join(projectDir, "biac.config.ts"), "utf8");
    writeFileSync(
      join(projectDir, "biac.config.ts"),
      config.replace(/\n};\s*$/, `\n  base: "${BASE}",\n};\n`),
    );
    buildProject(projectDir);
    // The host shape the demo deploys: the build's contents land under the
    // prefix; host.html is a consumer page on the same origin.
    staticHost = await servePrefixed(join(projectDir, "build"), "bi-as-code", {
      "host.html": `<!doctype html><title>host</title>${WIDGET_HOST_PAGE}`,
    });
  });

  test.afterAll(async () => {
    await staticHost.close();
    rmSync(projectDir, { recursive: true, force: true });
  });

  test("renders every route and read beneath the prefix", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));

    await page.goto(`${staticHost.url}${BASE}`);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Orders overview");

    // All seven charts ready means every query the page issued has landed.
    await openWeeklyReviewCharts(page, `${staticHost.url}${BASE}`);
    await expect(page).toHaveURL(/\/bi-as-code\/weekly-review\/$/);
    await expect(heading).toHaveText("Weekly review");

    // Root-absolute /assets/… or /data/… requests would escape the prefix —
    // every request to the publishing origin stays under the configured base.
    // (duckdb-wasm also lazily fetches its parquet extension from
    // extensions.duckdb.org — a different origin, not the leak.)
    const escapes = requested.filter(
      (url) =>
        url.startsWith(`${staticHost.url}/`) &&
        !url.startsWith(`${staticHost.url}${BASE}`),
    );
    expect(escapes).toEqual([]);
    expect(
      requested.some((url) => url.startsWith(`${staticHost.url}${BASE}data/`)),
    ).toBe(true);

    // duckdb-wasm reads parquet by range; the static host answers 206.
    const ranged = await fetch(`${staticHost.url}${BASE}data/flights.parquet`, {
      headers: { Range: "bytes=0-3" },
    });
    expect(ranged.status).toBe(206);
    expect(await ranged.text()).toBe("PAR1");
    expect(errors).toEqual([]);
  });

  test("a same-origin host page mounts the exported widget module under the prefix", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    const dataReads: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/data/")) dataReads.push(request.url());
    });

    // Module imports are CORS-mode and a plain static host grants nothing,
    // so the embedding page lives on the same origin — the only shape a
    // static host can run. The module's data base resolves ../ off itself.
    await page.goto(
      `${staticHost.url}/host.html?biac=${encodeURIComponent(BASE)}`,
    );
    await expect(page.locator("#status")).toHaveText("mounted");
    const mounted = await page.locator("#widget").evaluate((el) => ({
      shadow: el.shadowRoot !== null,
      text: el.shadowRoot?.textContent ?? "",
    }));
    expect(mounted.shadow).toBe(true);
    expect(mounted.text).toContain("Revenue by region");
    await expect
      .poll(async () =>
        page
          .locator("#widget")
          .evaluate(
            (el) => el.shadowRoot?.querySelectorAll("canvas").length ?? 0,
          ),
      )
      .toBe(1);

    expect(dataReads.length).toBeGreaterThan(0);
    expect(
      dataReads.every((url) => url.startsWith(`${staticHost.url}${BASE}data/`)),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
});
