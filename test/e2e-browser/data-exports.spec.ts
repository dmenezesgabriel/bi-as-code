import type { Page } from "@playwright/test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject, startBiacServer } from "../lib/dev-server.js";
import { withEmbedOrigins } from "../lib/framing-policy.js";
import { copyShippedProject } from "../lib/shipped-project.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { listOrigins } from "./embed-origins.js";

// A whole CSV, a ranged parquet read and a loader output — what another
// site fetches from a project, each read in the host page's own script.
const READS_SCRIPT = `
const base = new URLSearchParams(location.search).get("biac");
const reads = [
  ["data/orders.csv", {}],
  ["data/orders.parquet", { headers: { Range: "bytes=0-3" } }],
  ["data/weekly-orders.csv", {}],
];
const lines = await Promise.all(reads.map(async ([path, init]) => {
  try {
    const response = await fetch(base + path, init);
    const firstLine = (await response.text()).split("\\n")[0];
    return [response.status, response.headers.get("content-type"), firstLine].join(" ");
  } catch (error) {
    return error.name;
  }
}));
document.getElementById("results").textContent = lines.join("\\n");`;

const READ = [
  "200 text/csv order_id,week,order_date,region,amount",
  "206 application/vnd.apache.parquet PAR1",
  "200 text/csv week,orders,revenue",
];
const REFUSED = ["TypeError", "TypeError", "TypeError"];
const CORS_REFUSAL = "has been blocked by CORS policy";

/**
 * A host page on its own `127.0.0.1` server that fetches the biac server's
 * `/data/` files and prints each result. It must be a real loopback origin:
 * Chromium's Local Network Access checks refuse a page it counts as public
 * fetching localhost, which would hide whether CORS refused it.
 */
async function serveFetchingHost(): Promise<Server> {
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end(
      `<!doctype html><title>host</title><pre id="results"></pre><script type="module">${READS_SCRIPT}</script>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function originOf(server: Server): string {
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Opens the host page at `hostOrigin` against `biacUrl` and waits for its three results. */
async function readsFrom(
  page: Page,
  hostOrigin: string,
  biacUrl: string,
): Promise<string[]> {
  await page.goto(
    `${hostOrigin}/host.html?biac=${encodeURIComponent(biacUrl)}`,
  );
  const results = page.locator("#results");
  await expect(results).not.toBeEmpty();
  return (await results.textContent())!.split("\n");
}

/** The console errors that are not the browser refusing a cross-origin read. */
function unexpectedErrors(errors: readonly string[]): string[] {
  return errors.filter(
    (error) =>
      !error.includes(CORS_REFUSAL) && !error.includes("net::ERR_FAILED"),
  );
}

function corsRefusals(errors: readonly string[]): number {
  return errors.filter((error) => error.includes(CORS_REFUSAL)).length;
}

test("biac dev lets only the origins biac.config.ts lists read /data/", async ({
  page,
  biacDev,
}) => {
  const listed = await serveFetchingHost();
  const unlisted = await serveFetchingHost();
  const errors = collectConsoleErrors(page);
  try {
    const host = originOf(listed);
    expect(await readsFrom(page, host, biacDev.url)).toEqual(REFUSED);

    await listOrigins(biacDev.projectDir, biacDev.log, [host], "dataOrigins");
    expect(await readsFrom(page, host, biacDev.url)).toEqual(READ);
    expect(await readsFrom(page, originOf(unlisted), biacDev.url)).toEqual(
      REFUSED,
    );

    expect(corsRefusals(errors)).toBe(6);
    expect(unexpectedErrors(errors)).toEqual([]);
  } finally {
    listed.close();
    unlisted.close();
  }
});

test("a built biac preview lets only the origins biac.config.ts lists read /data/", async ({
  page,
}) => {
  const listed = await serveFetchingHost();
  const unlisted = await serveFetchingHost();
  const projectDir = mkdtempSync(join(tmpdir(), "biac-data-exports-"));
  copyShippedProject(projectDir);
  const configFile = join(projectDir, "biac.config.ts");
  const config = readFileSync(configFile, "utf8");
  writeFileSync(
    configFile,
    withEmbedOrigins(config, [originOf(listed)], "dataOrigins"),
  );
  buildProject(projectDir);
  const preview = await startBiacServer("preview", projectDir);
  const errors = collectConsoleErrors(page);
  try {
    expect(await readsFrom(page, originOf(listed), preview.url)).toEqual(READ);
    expect(await readsFrom(page, originOf(unlisted), preview.url)).toEqual(
      REFUSED,
    );

    expect(corsRefusals(errors)).toBe(3);
    expect(unexpectedErrors(errors)).toEqual([]);
  } finally {
    await preview.stop();
    listed.close();
    unlisted.close();
    rmSync(projectDir, { recursive: true, force: true });
  }
});
