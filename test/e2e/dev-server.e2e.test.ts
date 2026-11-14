import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCli, startDevServer, type DevServer } from "../lib/dev-server.js";
import {
  DENY_ALL,
  framingPolicy,
  revalidatedFramingPolicy,
  withEmbedOrigins,
} from "../lib/framing-policy.js";
import { eventually } from "../lib/http.js";
import {
  PAGE_SWAP_LOGGED_PATH,
  rewriteUntilServerLogs,
} from "../lib/write-until-logged.js";

let projectRoot: string | undefined;
let server: DevServer | undefined;

beforeAll(() => {
  // The e2e exercises the shipped artifact: bin/biac runs dist/cli, never src.
  buildCli();
  projectRoot = mkdtempSync(join(tmpdir(), "biac-e2e-"));
  mkdirSync(join(projectRoot, "pages"));
  writeFileSync(
    join(projectRoot, "pages/index.md"),
    "---\ntitle: Home\n---\n# Hi\n\n```sql orders\nselect 1\n```\n",
  );
}, 120_000);

afterAll(async () => {
  server?.kill();
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
});

/**
 * Runs `rewrite` until the server logs the page swap, then asserts the swap
 * was an HMR update with no page reload, and that the server stops cleanly.
 */
async function expectHotUpdate(
  dev: DevServer,
  rewrite: () => void,
): Promise<void> {
  const line = await rewriteUntilServerLogs({
    rewrite,
    log: dev.log,
    loggedPath: PAGE_SWAP_LOGGED_PATH,
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });

  expect(line).toMatch(/ hmr update /);
  expect(dev.log()).not.toContainEqual(expect.stringMatching(/ page reload /));
  expect(await dev.stop()).toBe(0);
}

describe("biac dev", () => {
  it("serves the SPA and compiled page modules, then shuts down on SIGINT", async () => {
    server = await startDevServer(projectRoot!);
    const base = server.url;

    const index = await fetch(base);
    expect(index.status).toBe(200);
    expect(await index.text()).toContain('id="root"');

    // `?import` marks the /@fs request as a JS module import — the same URL
    // shape the manifest's lazy `import()` produces. Without it vite serves
    // the raw markdown instead of running the transform pipeline.
    const page = await fetch(`${base}@fs${projectRoot}/pages/index.md?import`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("export const sqlBlocks");

    expect(await server.stop()).toBe(0);
  }, 60_000);

  it("reads and writes page source through /__biac/page-source/", async () => {
    server = await startDevServer(projectRoot!);
    const url = `${server.url}__biac/page-source/index.md`;

    const before = await fetch(url);
    const saved = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "# Saved\n" }),
    });
    const after = await fetch(url);

    expect(await before.text()).toContain("# Hi");
    expect(saved.status).toBe(204);
    expect(await after.text()).toBe("# Saved\n");
    expect(await server.stop()).toBe(0);
  }, 60_000);

  it("keeps its timestamped output for its whole life, debug lines included", async () => {
    server = await startDevServer(projectRoot!, { DEBUG: "vite:time" });

    await fetch(`${server.url}src/main.tsx`);
    await eventually(async () =>
      server!.log().some((line) => line.includes("vite:time")),
    );

    expect(server.log()).toContainEqual(
      expect.stringMatching(/^\d{4}-\d\d-\d\dT[\d:.]+Z stdout .*Local:/),
    );
    expect(server.log().join("\n")).not.toContain("\x1b[");
    expect(await server.stop()).toBe(0);
  }, 60_000);

  it("acknowledges a biac.config.ts write with a page reload naming it", async () => {
    const configFile = join(projectRoot!, "biac.config.ts");
    writeFileSync(configFile, 'export default { title: "Before" };\n');
    server = await startDevServer(projectRoot!);
    // A config edit reloads only a client that loaded the config module.
    await fetch(`${server.url}@id/__x00__virtual:biac-config`);

    const line = await rewriteUntilServerLogs({
      rewrite: () =>
        writeFileSync(configFile, 'export default { title: "After" };\n'),
      log: server.log,
      loggedPath: "biac.config.ts",
      attemptMs: 3_000,
      timeoutMs: 20_000,
    });

    expect(line).toMatch(/ page reload \S*\/biac\.config\.ts/);
    expect(await server.stop()).toBe(0);
  }, 60_000);

  it("acknowledges an added page with a page reload naming it", async () => {
    server = await startDevServer(projectRoot!);
    // An added page reloads only a client that loaded the manifest module.
    await fetch(`${server.url}@id/__x00__virtual:biac-pages`);

    const line = await rewriteUntilServerLogs({
      rewrite: () =>
        writeFileSync(
          join(projectRoot!, "pages/added.md"),
          "---\ntitle: Added\n---\n# Added\n",
        ),
      log: server.log,
      loggedPath: "pages/added.md",
      attemptMs: 3_000,
      timeoutMs: 20_000,
    });

    expect(line).toMatch(/ page reload \S*\/pages\/added\.md/);
    expect(await server.stop()).toBe(0);
  }, 60_000);

  it("hot-updates a page, without a reload, when a query file it reads is saved", async () => {
    mkdirSync(join(projectRoot!, "queries"), { recursive: true });
    const queryFile = join(projectRoot!, "queries/totals.sql");
    writeFileSync(queryFile, "select 1 as n\n");
    const page = join(projectRoot!, "pages/totals.md");
    writeFileSync(page, '# Totals\n\n<Table data="/queries/totals" />\n');
    server = await startDevServer(projectRoot!);
    // Only modules a client loaded join vite's graph: the manifest, which
    // accepts every page, and the page that reads the file, requested as a
    // module import (`?import`) the way the manifest's loader requests it.
    await fetch(`${server.url}@id/__x00__virtual:biac-pages`);
    await fetch(`${server.url}@fs${page}?import`);

    await expectHotUpdate(server, () =>
      writeFileSync(queryFile, "select 2 as n\n"),
    );
  }, 60_000);

  it("hot-updates a page, without a reload, when translations.yaml is saved", async () => {
    const translations = join(projectRoot!, "translations.yaml");
    writeFileSync(translations, "en:\n  title: Before\n");
    const page = join(projectRoot!, "pages/translated.md");
    writeFileSync(page, "# {$translations.title}\n");
    server = await startDevServer(projectRoot!);
    // As above: the manifest and the page join vite's graph only once a
    // client loads them, and the page pulls in the translations module.
    await fetch(`${server.url}@id/__x00__virtual:biac-pages`);
    await fetch(`${server.url}@fs${page}?import`);
    await fetch(`${server.url}@id/__x00__virtual:biac-translations`);

    await expectHotUpdate(server, () =>
      writeFileSync(translations, "en:\n  title: After\n"),
    );
  }, 60_000);

  it("logs each data loader run, and a failing loader's error and stderr", async () => {
    mkdirSync(join(projectRoot!, "data"), { recursive: true });
    writeFileSync(
      join(projectRoot!, "data/ok.csv.js"),
      'process.stdout.write("x\\n1\\n");\n',
    );
    writeFileSync(
      join(projectRoot!, "data/bad.csv.js"),
      'process.stderr.write("upstream timed out\\n");\nprocess.exit(3);\n',
    );
    server = await startDevServer(projectRoot!);

    await (await fetch(`${server.url}data/ok.csv`)).text();
    await (await fetch(`${server.url}data/bad.csv`)).text();
    await eventually(async () =>
      server!.log().some((line) => line.includes("exited with code 3")),
    );

    const log = server.log().join("\n");
    expect(log).toMatch(
      / stdout .*data loader data\/ok\.csv\.js → 4 bytes in \d+ ms/,
    );
    expect(log).toMatch(/ stderr upstream timed out/);
    expect(log).toMatch(
      / stderr .*data loader data\/bad\.csv\.js exited with code 3, expected 0/,
    );
    expect(await server.stop()).toBe(0);
  }, 60_000);
});

describe("biac dev framing policy", () => {
  /** A one-page project whose biac.config.ts lists `origins`; deleted after the block. */
  function projectListing(origins: readonly string[]): string {
    const root = mkdtempSync(join(tmpdir(), "biac-e2e-framing-"));
    mkdirSync(join(root, "pages"));
    writeFileSync(join(root, "pages/index.md"), "# Hi\n");
    writeFileSync(
      join(root, "biac.config.ts"),
      withEmbedOrigins("export default {\n};\n", origins),
    );
    framingProjects.push(root);
    return root;
  }

  const framingProjects: string[] = [];
  afterAll(() => {
    for (const root of framingProjects)
      rmSync(root, { recursive: true, force: true });
  });

  it("allows exactly the origins biac.config.ts lists on a deep link", async () => {
    server = await startDevServer(projectListing(["http://localhost:8901"]));

    const policy = await framingPolicy(`${server.url}index`);

    expect(policy).toEqual({
      csp: "frame-ancestors http://localhost:8901",
      xfo: "DENY",
    });
    expect(await server.stop()).toBe(0);
  }, 60_000);

  it("keeps the policy on a 304, so a cached page is not framed under an earlier list", async () => {
    server = await startDevServer(projectListing([]));

    const policy = await revalidatedFramingPolicy(`${server.url}index`);

    expect(policy).toEqual({ status: 304, ...DENY_ALL });
    expect(await server.stop()).toBe(0);
  }, 60_000);

  it("denies every framer on the error page while biac.config.ts fails to load", async () => {
    server = await startDevServer(projectListing(["*"]));

    const response = await fetch(server.url);
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain("embed.origins[0]");
    expect({
      csp: response.headers.get("content-security-policy"),
      xfo: response.headers.get("x-frame-options"),
    }).toEqual(DENY_ALL);
    expect(await server.stop()).toBe(0);
  }, 60_000);
});
