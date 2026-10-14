import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCli, startDevServer, type DevServer } from "../lib/dev-server.js";
import { eventually } from "../lib/http.js";

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
});
