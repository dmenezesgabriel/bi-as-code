import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pagesPlugin } from "@/engine/pages-plugin.js";

const webRoot = fileURLToPath(new URL("../../src/web", import.meta.url));
const VIRTUAL_MANIFEST_ID = "virtual:biac-pages";
const RESOLVED_MANIFEST_ID = "\0virtual:biac-pages";

let projectRoot: string | undefined;
let server: ViteDevServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  projectRoot = undefined;
});

function makeProject(): string {
  projectRoot = mkdtempSync(join(tmpdir(), "biac-site-"));
  return projectRoot;
}

function writePage(relativePath: string, content: string): void {
  const file = join(projectRoot!, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/**
 * Real vite dev server with `src/web` as root, matching `biac dev`: pages
 * live outside the vite root, so every request goes through `/@fs/` and the
 * plugin's `server.fs.allow` grant.
 */
async function makeServer(root: string): Promise<ViteDevServer> {
  server = await createServer({
    root: webRoot,
    configFile: false,
    logLevel: "error",
    plugins: [pagesPlugin(root)],
    server: { middlewareMode: true },
  });
  return server;
}

/**
 * Polls until chokidar has finished scanning `pagesDir` — its `getWatched()`
 * entry only lists files once that directory's readdir completed, so a write
 * afterwards is guaranteed to arrive as a real event (vite's watcher runs
 * `ignoreInitial`, which swallows files discovered mid-scan). Unlike `ready`,
 * this cannot race: a `ready` listener attached after `createServer` can miss
 * a scan that finished during server setup.
 */
async function waitForWatch(
  dev: ViteDevServer,
  pagesDir: string,
  fileName: string,
): Promise<void> {
  await vi.waitFor(
    () => {
      expect(dev.watcher.getWatched()[pagesDir]).toContain(fileName);
    },
    { timeout: 10000 },
  );
}

async function loadManifest(dev: ViteDevServer): Promise<string> {
  const result = await dev.transformRequest(VIRTUAL_MANIFEST_ID);
  return result?.code ?? "";
}

function manifestModule(dev: ViteDevServer) {
  return dev.environments.client.moduleGraph.getModuleById(
    RESOLVED_MANIFEST_ID,
  );
}

function pageModule(dev: ViteDevServer, file: string) {
  return dev.environments.client.moduleGraph.getModuleById(file);
}

describe("page transform", () => {
  it("compiles a page under pages/ into a module on request", async () => {
    const root = makeProject();
    writePage(
      "pages/index.md",
      "---\ntitle: Home\n---\n# Hi\n\n```sql orders\nselect 1\n```\n",
    );
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toContain("export default");
    expect(result?.code).toContain('export const title = "Home";');
    expect(result?.code).toContain("export const sqlBlocks");
  });

  it("leaves markdown outside pages/ untransformed", async () => {
    const root = makeProject();
    writePage("notes.md", "# Not a page\n");
    const dev = await makeServer(root);

    const result = await dev.transformRequest(`/@fs${join(root, "notes.md")}`);

    expect(result?.code).toBe("# Not a page\n");
  });

  it("surfaces compile errors instead of serving a broken page", async () => {
    const root = makeProject();
    writePage("pages/index.md", "---\ntitle: [unclosed\n---\n");
    const dev = await makeServer(root);

    await expect(
      dev.transformRequest(`/@fs${join(root, "pages/index.md")}`),
    ).rejects.toThrow();
  });
});

describe("virtual:biac-pages", () => {
  it("exposes manifest entries with a lazy loader per page", async () => {
    const root = makeProject();
    writePage("pages/index.md", "---\ntitle: Home\n---\n# Hi\n");
    writePage("pages/nested/page.md", "# Nested\n");
    const dev = await makeServer(root);

    const code = await loadManifest(dev);

    expect(code).toContain('route: "/"');
    expect(code).toContain('route: "/nested/page"');
    // importAnalysis rewrites the emitted loaders to their /@fs/ URLs.
    expect(code).toContain(`/@fs${join(root, "pages/index.md")}`);
    expect(code).toContain(`/@fs${join(root, "pages/nested/page.md")}`);
  });

  it("produces an empty manifest when pages/ is missing", async () => {
    const root = makeProject();
    const dev = await makeServer(root);

    const code = await loadManifest(dev);

    expect(code).not.toContain("/@fs");
  });
});

describe("file watching", () => {
  it("invalidates the manifest when a page is added", async () => {
    const root = makeProject();
    writePage("pages/index.md", "# Hi\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "index.md");
    await loadManifest(dev);
    const manifest = manifestModule(dev);
    const timestamp = manifest!.lastInvalidationTimestamp;

    writePage("pages/new.md", "# New\n");

    await vi.waitFor(
      () => {
        expect(manifest!.lastInvalidationTimestamp).toBeGreaterThan(timestamp);
      },
      { timeout: 10000 },
    );
    expect(await loadManifest(dev)).toContain('route: "/new"');
  });

  it("invalidates the manifest when a page is removed", async () => {
    const root = makeProject();
    const file = join(root, "pages/gone.md");
    writePage("pages/gone.md", "# Gone\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "gone.md");
    await loadManifest(dev);
    const manifest = manifestModule(dev);
    const timestamp = manifest!.lastInvalidationTimestamp;

    rmSync(file);

    await vi.waitFor(
      () => {
        expect(manifest!.lastInvalidationTimestamp).toBeGreaterThan(timestamp);
      },
      { timeout: 10000 },
    );
    expect(await loadManifest(dev)).not.toContain("/@fs");
  });

  it("invalidates the page module when a page is edited", async () => {
    const root = makeProject();
    const pagePath = join(root, "pages/index.md");
    writePage("pages/index.md", "# Old heading\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "index.md");
    await dev.transformRequest(`/@fs${pagePath}`);
    const page = pageModule(dev, pagePath);
    const timestamp = page!.lastInvalidationTimestamp;

    writePage("pages/index.md", "# New heading\n");

    await vi.waitFor(
      () => {
        expect(page!.lastInvalidationTimestamp).toBeGreaterThan(timestamp);
      },
      { timeout: 10000 },
    );
    const result = await dev.transformRequest(`/@fs${pagePath}`);
    expect(result?.code).toContain("New heading");
  });
});
