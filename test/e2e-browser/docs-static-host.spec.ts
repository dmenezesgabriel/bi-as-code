import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "../lib/dev-server.js";
import { servePrefixed } from "../lib/prefixed-host.js";
import { copyDocsProject } from "../lib/shipped-project.js";
import type { StaticDir } from "../lib/static-server.js";
import {
  collectConsoleErrors,
  expect,
  resultTables,
  test,
} from "./dev-server.fixture.js";

// The docs project as GitHub Pages serves it: its own committed `base`
// (docs/biac.config.ts), built, then placed beneath that prefix on a host
// with no rewrite rule — directory URLs answer their own index.html and
// nothing falls back to the shell.
const BASE = "/bi-as-code/";

test.describe("the docs build under its GitHub Pages base", () => {
  let projectDir: string;
  let staticHost: StaticDir;

  test.beforeAll(async () => {
    projectDir = mkdtempSync(join(tmpdir(), "biac-docs-pages-"));
    copyDocsProject(projectDir);
    buildProject(projectDir);
    staticHost = await servePrefixed(join(projectDir, "build"), "bi-as-code");
  });

  test.afterAll(async () => {
    await staticHost.close();
    rmSync(projectDir, { recursive: true, force: true });
  });

  test("a deep link renders, redirects to its slash and survives a reload", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    const heading = page.getByRole("heading", { level: 1 });

    await page.goto(`${staticHost.url}${BASE}`);
    await expect(heading).toBeVisible();

    // The host 301s the slash-less URL and the route's own index.html answers.
    await page.goto(`${staticHost.url}${BASE}components/table`);
    await expect(page).toHaveURL(/\/bi-as-code\/components\/table\/$/);
    await expect(heading).toHaveText("Table");
    expect((await page.reload())?.status()).toBe(200);
    await expect(heading).toHaveText("Table");

    expect(errors).toEqual([]);
  });

  test("a filtered URL keeps its pick on reload and every request stays under the prefix", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));
    const filtered = `${staticHost.url}${BASE}filters/filters-and-urls/?island=Dream`;

    expect((await page.goto(filtered))?.status()).toBe(200);
    const island = page.getByRole("combobox", { name: "Island" }).first();
    const rows = resultTables(page).first().locator("tbody tr");
    // Dream holds two of the five island × species pairs, so two rows mean
    // data/penguins.csv was read from beneath the prefix.
    await expect(island).toHaveText("Dream");
    await expect(rows).toHaveCount(2);
    expect((await page.reload())?.status()).toBe(200);
    await expect(island).toHaveText("Dream");
    await expect(rows).toHaveCount(2);

    // Root-absolute /assets/… or /data/… would escape the prefix and 404 on
    // a project site. (duckdb-wasm's lazy extension fetch is another origin.)
    const origin = `${staticHost.url}/`;
    const escapes = requested.filter(
      (url) =>
        url.startsWith(origin) && !url.startsWith(`${staticHost.url}${BASE}`),
    );
    expect(escapes).toEqual([]);
    expect(errors).toEqual([]);
  });
});
