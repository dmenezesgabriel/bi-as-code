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

/** How long a filesystem mutation may take to reach vite's watcher. */
const WATCH_WAIT_MS = 10_000;

// Every test here boots a vite dev server, and a watch test then waits up
// to WATCH_WAIT_MS for its event: vitest's 5s default would kill a test
// before its own wait could run out on a loaded host.
vi.setConfig({ testTimeout: 2 * WATCH_WAIT_MS });

/** Asserts `act()` (a filesystem mutation) bumps the module's invalidation timestamp. */
async function expectInvalidated(
  module: { lastInvalidationTimestamp: number } | undefined,
  act: () => void,
): Promise<void> {
  const timestamp = module!.lastInvalidationTimestamp;
  act();
  await vi.waitFor(
    () => {
      expect(module!.lastInvalidationTimestamp).toBeGreaterThan(timestamp);
    },
    { timeout: WATCH_WAIT_MS },
  );
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

  it("serves a page that fails to compile as a module carrying the error", async () => {
    const root = makeProject();
    writeFile("pages/index.md", "# Hi\n\n<Callout\n");
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toMatch(
      /^export const compileError = \{"file":"pages\/index\.md","message":"Unexpected end of file[^\n]*"line":4,"column":1\};\n$/,
    );
  });

  it("serves a page naming a filter with the editor's URL key as a compile error at the attribute", async () => {
    const root = makeProject();
    writeFile("pages/index.md", '# Hi\n\n<TextInput id="edit" />\n');
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toMatch(
      /^export const compileError = \{"file":"pages\/index\.md","message":"Reserved filter id \\"edit\\" on <TextInput id>[^\n]*"line":3,"column":12\};\n$/,
    );
  });

  it("serves a page with unparseable front-matter as a compile error", async () => {
    const root = makeProject();
    writeFile("pages/index.md", "---\ntitle: [unclosed\n---\n");
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toMatch(
      /^export const compileError = \{"file":"pages\/index\.md".*"line":2,"column":17\};\n$/,
    );
  });

  it("reports a page whose sql: table name collides with biac.config.ts", async () => {
    const root = makeProject();
    writeFile(
      "biac.config.ts",
      'export default { sql: { orders: "data/orders.csv" } };\n',
    );
    writeFile(
      "pages/index.md",
      "---\nsql:\n  orders: data/other.csv\n---\n# Hi\n",
    );
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toMatch(
      /^export const compileError = .*pages\/index\.md.*sql\.orders.*biac\.config\.ts/,
    );
  });

  it("re-checks a page against a config edit so a new collision surfaces", async () => {
    const root = makeProject();
    writeFile("biac.config.ts", "export default {};\n");
    writeFile("pages/index.md", "---\nsql:\n  orders: data/a.csv\n---\n# Hi\n");
    const dev = await makeServer(root);
    const pagePath = join(root, "pages/index.md");
    await waitForWatch(dev, root, "biac.config.ts");
    await dev.transformRequest(`/@fs${pagePath}`);

    await expectInvalidated(pageModule(dev, pagePath), () =>
      writeFileSync(
        join(root, "biac.config.ts"),
        'export default { sql: { orders: "data/b.csv" } };\n',
      ),
    );

    const result = await dev.transformRequest(`/@fs${pagePath}`);
    expect(result?.code).toMatch(
      /^export const compileError = .*biac\.config\.ts/,
    );
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
    expect(code).toContain(
      'export const navTree = {"rootPages":[],"directories":[]};',
    );
  });

  it("carries front-matter nav fields on entries and exports the nav tree", async () => {
    const root = makeProject();
    writeFile("pages/index.md", "---\ntitle: Home\n---\n# Hi\n");
    writeFile("pages/nested/b.md", "---\nsidebar_position: 2\n---\n# B\n");
    writeFile(
      "pages/nested/a.md",
      "---\ntitle: Aye\nsidebar_position: 1\n---\n# A\n",
    );
    const dev = await makeServer(root);

    const code = await loadManifest(dev);

    expect(code).toContain('title: "Home"');
    expect(code).toContain('title: "Aye"');
    expect(code).toContain("sidebarPosition: 2");
    expect(code).toContain('"rootPages":[{"name":"Home","href":"/"}]');
    expect(code).toContain(
      '"directories":[{"id":"nested","name":"Nested","pages":[{"name":"Aye","href":"/nested/a"},{"name":"B","href":"/nested/b"}]}]',
    );
  });
});

describe("file watching", () => {
  it("invalidates the manifest when a page is added", async () => {
    const root = makeProject();
    writeFile("pages/index.md", "# Hi\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "index.md");
    await loadManifest(dev);

    await expectInvalidated(manifestModule(dev), () =>
      writeFile("pages/new.md", "# New\n"),
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

    await expectInvalidated(manifestModule(dev), () => rmSync(file));

    expect(await loadManifest(dev)).not.toContain("/@fs");
  });

  it("invalidates only the page module when a page's body is edited", async () => {
    const root = makeProject();
    const pagePath = join(root, "pages/index.md");
    writeFile("pages/index.md", "# Old heading\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "index.md");
    await loadManifest(dev);
    await dev.transformRequest(`/@fs${pagePath}`);
    const manifestTimestamp = manifestModule(dev)!.lastInvalidationTimestamp;

    await expectInvalidated(pageModule(dev, pagePath), () =>
      writeFile("pages/index.md", "# New heading\n"),
    );

    const result = await dev.transformRequest(`/@fs${pagePath}`);
    expect(result?.code).toContain("New heading");
    expect(manifestModule(dev)!.lastInvalidationTimestamp).toBe(
      manifestTimestamp,
    );
  });

  it("makes the manifest the HMR boundary for every page module", async () => {
    const root = makeProject();
    const pagePath = join(root, "pages/index.md");
    writeFile("pages/index.md", "# Hi\n");
    const dev = await makeServer(root);
    await loadManifest(dev);

    const accepted = [...manifestModule(dev)!.acceptedHmrDeps];

    expect(accepted.map((mod) => mod.file)).toEqual([pagePath]);
  });

  it("keeps the manifest when a non-nav front-matter field is edited", async () => {
    const root = makeProject();
    const pagePath = join(root, "pages/index.md");
    writeFile("pages/index.md", "---\ntitle: Same\n---\n# Hi\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "index.md");
    await loadManifest(dev);
    await dev.transformRequest(`/@fs${pagePath}`);
    const manifestTimestamp = manifestModule(dev)!.lastInvalidationTimestamp;

    await expectInvalidated(pageModule(dev, pagePath), () =>
      writeFile(
        "pages/index.md",
        "---\ntitle: Same\ntable_of_contents: false\n---\n# Hi\n",
      ),
    );

    expect(manifestModule(dev)!.lastInvalidationTimestamp).toBe(
      manifestTimestamp,
    );
  });

  it("keeps the manifest when an edit breaks a page's front-matter, so the page reports it", async () => {
    const root = makeProject();
    const pagePath = join(root, "pages/index.md");
    writeFile("pages/index.md", "---\ntitle: Ok\n---\n# Hi\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "index.md");
    await loadManifest(dev);
    await dev.transformRequest(`/@fs${pagePath}`);
    const manifestTimestamp = manifestModule(dev)!.lastInvalidationTimestamp;

    await expectInvalidated(pageModule(dev, pagePath), () =>
      writeFile("pages/index.md", "---\ntitle: [unclosed\n---\n# Hi\n"),
    );

    const result = await dev.transformRequest(`/@fs${pagePath}`);
    expect(result?.code).toMatch(/^export const compileError = /);
    expect(manifestModule(dev)!.lastInvalidationTimestamp).toBe(
      manifestTimestamp,
    );
  });

  it("invalidates the manifest when a page's front-matter is edited", async () => {
    const root = makeProject();
    writeFile("pages/index.md", "---\ntitle: Old\n---\n# Hi\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "index.md");
    await loadManifest(dev);

    await expectInvalidated(manifestModule(dev), () =>
      writeFile("pages/index.md", "---\ntitle: New\n---\n# Hi\n"),
    );

    expect(await loadManifest(dev)).toContain('title: "New"');
    expect(await loadManifest(dev)).toContain('"name":"New"');
  });
});

describe("virtual:biac-config", () => {
  it("rejects a config typo with vite's id and the key's loc", async () => {
    const root = makeProject();
    writeFile("biac.config.ts", 'export default {\n  pagewidth: "full",\n};\n');
    const file = join(root, "biac.config.ts");
    const dev = await makeServer(root);

    const error = await dev
      .transformRequest(VIRTUAL_CONFIG_ID)
      .catch((thrown: unknown) => thrown);

    expect(error).toMatchObject({
      message: expect.stringMatching(
        /^Invalid biac\.config\.ts:2:3 — pagewidth/,
      ),
      id: file,
      loc: { file, line: 2, column: 3 },
    });
  });

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

  it("serves project sql tables declared in biac.config.ts", async () => {
    const root = makeProject();
    writeFile(
      "biac.config.ts",
      'export default { sql: { orders: "data/orders.csv" } };\n',
    );
    const dev = await makeServer(root);

    const code = await loadConfigModule(dev);

    expect(code).toContain('"sqlTables":{"orders":"data/orders.csv"}');
  });

  it("keeps the loader interpreters out of the browser", async () => {
    const root = makeProject();
    writeFile(
      "biac.config.ts",
      'export default { interpreters: { ".pl": ["perl"] } };\n',
    );
    const dev = await makeServer(root);

    const code = await loadConfigModule(dev);

    expect(code).not.toContain("interpreters");
    expect(code).not.toContain(process.execPath);
  });

  it("serves defaults when biac.config.ts is absent", async () => {
    const root = makeProject();
    const dev = await makeServer(root);

    const code = await loadConfigModule(dev);

    expect(code).toContain('"biac"');
    expect(code).toContain('"system"');
    expect(code).toContain('"sidebar":true');
    expect(code).toContain('"sqlTables":{}');
  });

  it("invalidates the config module when biac.config.ts is edited", async () => {
    const root = makeProject();
    const configPath = join(root, "biac.config.ts");
    writeFile("biac.config.ts", 'export default { title: "ACME" };\n');
    const dev = await makeServer(root);
    await waitForWatch(dev, root, "biac.config.ts");
    await loadConfigModule(dev);

    await expectInvalidated(configModule(dev), () =>
      writeFileSync(configPath, 'export default { title: "Umbrella" };\n'),
    );

    expect(await loadConfigModule(dev)).toContain('"Umbrella"');
  });

  it("reloads the page when biac.config.ts is fixed after a failed load", async () => {
    const root = makeProject();
    const configPath = join(root, "biac.config.ts");
    writeFile("biac.config.ts", 'export default { pagewidth: "full" };\n');
    const dev = await makeServer(root);
    await waitForWatch(dev, root, "biac.config.ts");
    await dev.transformRequest(VIRTUAL_CONFIG_ID).catch(() => undefined);
    const send = vi.spyOn(dev.environments.client.hot, "send");

    writeFileSync(configPath, 'export default { title: "ACME" };\n');

    await vi.waitFor(
      () => expect(send).toHaveBeenCalledWith({ type: "full-reload" }),
      { timeout: WATCH_WAIT_MS },
    );
  });

  it("injects the configured theme into index.html ahead of the inline script that reads it", async () => {
    const root = makeProject();
    writeFile("biac.config.ts", 'export default { theme: "dark" };\n');
    const dev = await makeServer(root);

    const html = await dev.transformIndexHtml(
      "/",
      "<html><head><script>var t = window.__BIAC_THEME__;</script></head><body></body></html>",
    );

    expect(html).toContain('__BIAC_THEME__="dark"');
    expect(html.indexOf('__BIAC_THEME__="dark"')).toBeLessThan(
      html.indexOf("window.__BIAC_THEME__"),
    );
  });

  it("injects system into index.html when biac.config.ts is absent", async () => {
    const root = makeProject();
    const dev = await makeServer(root);

    const html = await dev.transformIndexHtml(
      "/",
      "<html><head></head><body></body></html>",
    );

    expect(html).toContain('__BIAC_THEME__="system"');
  });
});
