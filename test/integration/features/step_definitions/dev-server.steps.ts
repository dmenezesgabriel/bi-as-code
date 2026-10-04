import assert from "node:assert/strict";
import {
  execFileSync,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { After, BeforeAll, Given, Then, When } from "@cucumber/cucumber";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
// Joined onto `base`, which already ends in "/" — a leading slash here
// would produce `//@id/…`, miss vite's module route and hit the SPA
// fallback instead.
const MANIFEST_URL = "@id/virtual:biac-pages";

let projectRoot: string | undefined;
let child: ChildProcessWithoutNullStreams | undefined;
let base: string | undefined;

BeforeAll(() => {
  // bin/biac runs dist/, never src — build once for the whole feature run.
  execFileSync(
    process.execPath,
    [
      join(repoRoot, "node_modules/typescript/bin/tsc"),
      "-p",
      "tsconfig.build.json",
    ],
    { cwd: repoRoot, stdio: "pipe" },
  );
});

After(async () => {
  child?.kill("SIGKILL");
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  child = undefined;
  projectRoot = undefined;
  base = undefined;
});

/**
 * Retries `check` until it passes or the deadline lapses — file-watch events
 * and server startup are timing-sensitive, and sleeping a fixed delay is how
 * flaky tests are born.
 */
async function eventually(
  check: () => Promise<boolean>,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`timed out after ${timeoutMs}ms waiting for condition`);
}

/** GETs `url` and returns its body text; a non-200 response fails loudly. */
async function getOk(url: string): Promise<string> {
  const res = await fetch(url);
  if (res.status !== 200) {
    throw new Error(`GET ${url} → ${res.status}, expected 200`);
  }
  return res.text();
}

/**
 * Finds an OS-assigned free port by listening on 0, then releases it. A
 * small race against other processes exists; strictPort failing the spawn
 * surfaces as a fetch timeout, which is loud enough for a test.
 */
async function freePort(): Promise<number> {
  const probe = createServer().listen(0);
  await new Promise<void>((resolve) => probe.once("listening", resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

Given("a project with an index page and a nested page", () => {
  projectRoot = mkdtempSync(join(tmpdir(), "biac-cucumber-"));
  mkdirSync(join(projectRoot, "pages/nested"), { recursive: true });
  writeFileSync(
    join(projectRoot, "pages/index.md"),
    "---\ntitle: Home\n---\n# Hi\n\n```sql orders\nselect 1\n```\n",
  );
  writeFileSync(join(projectRoot, "pages/nested/page.md"), "# Nested\n");
});

When("I start the dev server", async () => {
  assert.ok(projectRoot, "project must exist before starting the server");
  const port = await freePort();
  base = `http://localhost:${port}/`;
  child = spawn(process.execPath, [
    join(repoRoot, "bin/biac"),
    "dev",
    projectRoot,
    "--port",
    String(port),
  ]);
  await eventually(async () => {
    const res = await fetch(base!);
    return res.status === 200;
  });
});

Then("the root URL serves the SPA shell", async () => {
  assert.match(await getOk(base!), /id="root"/);
});

Then("the index page module compiles its title and sql block", async () => {
  const code = await getOk(`${base}@fs${projectRoot}/pages/index.md?import`);
  assert.match(code, /export const title = "Home";/);
  assert.match(code, /export const sqlBlocks = \[\{"name":"orders"/);
});

Then("the page manifest lists the index and nested routes", async () => {
  const code = await getOk(`${base}${MANIFEST_URL}`);
  assert.match(code, /route: "\/"/);
  assert.match(code, /route: "\/nested\/page"/);
});

When("I add a page file to the project", () => {
  assert.ok(projectRoot, "project must exist");
  writeFileSync(join(projectRoot, "pages/added.md"), "# Added later\n");
});

Then("the page manifest serves the new route", async () => {
  await eventually(async () =>
    (await getOk(`${base}${MANIFEST_URL}`)).includes('"/added"'),
  );
});

Then("the dev server exits cleanly on SIGINT", async () => {
  assert.ok(child, "server must be running");
  const code = await new Promise<number | null>((resolve) => {
    child!.once("exit", resolve);
    child!.kill("SIGINT");
  });
  assert.equal(code, 0);
});
