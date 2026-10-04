import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ViteDevServer } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makePagesServer, waitForWatch } from "../lib/pages-vite-server.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

const VIRTUAL_MANIFEST_ID = "virtual:biac-pages";
const RESOLVED_MANIFEST_ID = "\0virtual:biac-pages";
const VIRTUAL_CONFIG_ID = "virtual:biac-config";
const RESOLVED_CONFIG_ID = "\0virtual:biac-config";

let projectRoot: string | undefined;
let server: ViteDevServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
  cleanupProjects();
});

function makeProject(): string {
  projectRoot = makeTempProject();
  return projectRoot;
}

function writeFile(relativePath: string, content: string): void {
  writeProjectFile(projectRoot!, relativePath, content);
}

async function makeServer(root: string): Promise<ViteDevServer> {
  server = await makePagesServer(root);
  return server;
}

async function loadManifest(dev: ViteDevServer): Promise<string> {
  const result = await dev.transformRequest(VIRTUAL_MANIFEST_ID);
  return result?.code ?? "";
}

async function loadConfigModule(dev: ViteDevServer): Promise<string> {
  const result = await dev.transformRequest(VIRTUAL_CONFIG_ID);
  return result?.code ?? "";
}

function configModule(dev: ViteDevServer) {
  return dev.environments.client.moduleGraph.getModuleById(RESOLVED_CONFIG_ID);
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
    writeFile(
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
    writeFile("notes.md", "# Not a page\n");
    const dev = await makeServer(root);

    const result = await dev.transformRequest(`/@fs${join(root, "notes.md")}`);

    expect(result?.code).toBe("# Not a page\n");
  });

  it("surfaces compile errors instead of serving a broken page", async () => {
    const root = makeProject();
    writeFile("pages/index.md", "---\ntitle: [unclosed\n---\n");
    const dev = await makeServer(root);

    await expect(
      dev.transformRequest(`/@fs${join(root, "pages/index.md")}`),
    ).rejects.toThrow();
  });
});

describe("virtual:biac-pages", () => {
  it("exposes manifest entries with a lazy loader per page", async () => {
    const root = makeProject();
    writeFile("pages/index.md", "---\ntitle: Home\n---\n# Hi\n");
    writeFile("pages/nested/page.md", "# Nested\n");
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
    writeFile("pages/index.md", "# Hi\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "index.md");
    await loadManifest(dev);
    const manifest = manifestModule(dev);
    const timestamp = manifest!.lastInvalidationTimestamp;

    writeFile("pages/new.md", "# New\n");

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
    writeFile("pages/gone.md", "# Gone\n");
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
    writeFile("pages/index.md", "# Old heading\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "index.md");
    await dev.transformRequest(`/@fs${pagePath}`);
    const page = pageModule(dev, pagePath);
    const timestamp = page!.lastInvalidationTimestamp;

    writeFile("pages/index.md", "# New heading\n");

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

describe("virtual:biac-config", () => {
  it("serves the project's declared title, theme and nav", async () => {
    const root = makeProject();
    writeFile(
      "biac.config.ts",
      'export default { title: "ACME", theme: "dark", nav: { sidebar: false } };\n',
    );
    const dev = await makeServer(root);

    const code = await loadConfigModule(dev);

    expect(code).toContain('"ACME"');
    expect(code).toContain('"dark"');
    expect(code).toContain('"sidebar":false');
  });

  it("serves defaults when biac.config.ts is absent", async () => {
    const root = makeProject();
    const dev = await makeServer(root);

    const code = await loadConfigModule(dev);

    expect(code).toContain('"biac"');
    expect(code).toContain('"system"');
    expect(code).toContain('"sidebar":true');
  });

  it("invalidates the config module when biac.config.ts is edited", async () => {
    const root = makeProject();
    const configPath = join(root, "biac.config.ts");
    writeFile("biac.config.ts", 'export default { title: "ACME" };\n');
    const dev = await makeServer(root);
    await waitForWatch(dev, root, "biac.config.ts");
    await loadConfigModule(dev);
    const config = configModule(dev);
    const timestamp = config!.lastInvalidationTimestamp;

    writeFileSync(configPath, 'export default { title: "Umbrella" };\n');

    await vi.waitFor(
      () => {
        expect(config!.lastInvalidationTimestamp).toBeGreaterThan(timestamp);
      },
      { timeout: 10000 },
    );
    expect(await loadConfigModule(dev)).toContain('"Umbrella"');
  });
});
