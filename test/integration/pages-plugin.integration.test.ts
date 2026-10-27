import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ViteDevServer } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  expectInvalidated,
  makePagesServer,
  waitForWatch,
} from "../lib/pages-vite-server.js";
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

  it("inlines the query file a widget's data names into the page module", async () => {
    const root = makeProject();
    writeFile("queries/sales/totals.sql", "select 'from-the-file' as x\n");
    writeFile(
      "pages/index.md",
      '# Hi\n\n<Table data="/queries/sales/totals" />\n',
    );
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toContain(
      'export const sqlBlocks = [{"name":"/queries/sales/totals","sql":"select \'from-the-file\' as x\\n"}];',
    );
  });

  it("renders an mdx echo snippet's widget on its query file and keeps its markup", async () => {
    const root = makeProject();
    writeFile("queries/totals.sql", "select 1 as x\n");
    writeFile(
      "pages/index.md",
      '# Hi\n\n```mdx echo\n<Table data="/queries/totals" />\n```\n',
    );
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toContain("_jsx(Table, {");
    expect(result?.code).toContain('"<Table data=\\"/queries/totals\\" />\\n"');
    expect(result?.code).toContain(
      'export const sqlBlocks = [{"name":"/queries/totals","sql":"select 1 as x\\n"}];',
    );
  });

  it("serves an mdx fence with an unknown attribute as a compile error at the fence", async () => {
    const root = makeProject();
    writeFile("pages/index.md", "# Hi\n\n```mdx show\n<Table />\n```\n");
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toMatch(
      /^export const compileError = \{"file":"pages\/index\.md","message":"Unknown mdx fence attribute \\"show\\"[^\n]*"line":3,"column":1\};\n$/,
    );
  });

  it("inlines the query files a fence builds on, and the files they read", async () => {
    const root = makeProject();
    writeFile("queries/totals.sql", "select * from {{/queries/base}}\n");
    writeFile("queries/base.sql", "select 1 as x\n");
    writeFile(
      "pages/index.md",
      "# Hi\n\n```sql share\nselect * from {{/queries/totals}}\n```\n",
    );
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toContain(
      'export const sqlBlocks = [{"name":"share","sql":"select * from {{/queries/totals}}"},{"name":"/queries/totals","sql":"select * from {{/queries/base}}\\n"},{"name":"/queries/base","sql":"select 1 as x\\n"}];',
    );
  });

  it("serves a page naming a missing query file as a compile error at the attribute", async () => {
    const root = makeProject();
    writeFile("queries/totals.sql", "select 1\n");
    writeFile("pages/index.md", '# Hi\n\n<Table data="/queries/total" />\n');
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toMatch(
      /^export const compileError = \{"file":"pages\/index\.md","message":"Query file queries\/total\.sql not found for data=\\"\/queries\/total\\" \(did you mean \/queries\/totals\?\)[^\n]*"line":3,"column":8\};\n$/,
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

  it.each([
    ["page_width", "page_width: full", '{"page_width":"full"}'],
    [
      "cards",
      "page_width: full\ncards: true",
      '{"page_width":"full","cards":true}',
    ],
    [
      "table_of_contents",
      "table_of_contents: true",
      '{"table_of_contents":true}',
    ],
    [
      "table_of_contents_label",
      "table_of_contents_label: Contents",
      '{"table_of_contents_label":"Contents"}',
    ],
  ])(
    "serves a page's %s front-matter in its layout export",
    async (_key, frontmatter, layout) => {
      const root = makeProject();
      writeFile("pages/index.md", `---\n${frontmatter}\n---\n# Hi\n`);
      const dev = await makeServer(root);

      const result = await dev.transformRequest(
        `/@fs${join(root, "pages/index.md")}`,
      );

      expect(result?.code).toContain(`export const layout = ${layout};`);
    },
  );

  it.each([
    [
      "table_of_contents is not a boolean",
      'table_of_contents: "no"',
      'table_of_contents: expected a boolean, got \\"no\\"',
    ],
    [
      "table_of_contents_label is empty",
      'table_of_contents_label: ""',
      'table_of_contents_label: expected a non-empty string, got \\"\\"',
    ],
  ])(
    "serves a page whose %s as a compile error",
    async (_case, frontmatter, message) => {
      const root = makeProject();
      writeFile("pages/index.md", `---\n${frontmatter}\n---\n# Hi\n`);
      const dev = await makeServer(root);

      const result = await dev.transformRequest(
        `/@fs${join(root, "pages/index.md")}`,
      );

      expect(result?.code).toContain(message);
    },
  );

  it("serves a page whose page_width is not article or full as a compile error", async () => {
    const root = makeProject();
    writeFile("pages/index.md", "---\npage_width: wide\n---\n# Hi\n");
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toMatch(
      /^export const compileError = \{"file":"pages\/index\.md","message":"Invalid front-matter in pages\/index\.md — page_width: expected \\"article\\" \| \\"full\\", got \\"wide\\""/,
    );
  });

  it("serves a page whose header is not a boolean as a compile error", async () => {
    const root = makeProject();
    writeFile("pages/index.md", "---\nheader: no thanks\n---\n# Hi\n");
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toMatch(
      /^export const compileError = \{"file":"pages\/index\.md","message":"Invalid front-matter in pages\/index\.md — header: expected a boolean, got \\"no thanks\\""/,
    );
  });

  it("serves a page's front-matter brand as its brandCss export", async () => {
    const root = makeProject();
    writeFile(
      "pages/index.md",
      '---\nbrand:\n  palette:\n    dark: ["#60a5fa"]\n---\n# Hi\n',
    );
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toContain(
      'export const brandCss = ".dark {\\n  --chart-1: #60a5fa;\\n}\\n";',
    );
  });

  it("serves a page's front-matter fonts and radius as one root rule in its brandCss export", async () => {
    const root = makeProject();
    writeFile(
      "pages/index.md",
      '---\nbrand:\n  fonts: { body: "sans-serif" }\n  radius: "1rem"\n---\n# Hi\n',
    );
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toContain(
      'export const brandCss = ":root {\\n  --body-font: var(--font-stack-sans-serif);\\n  --radius: 1rem;\\n}\\n";',
    );
  });

  it("serves a page brand colour under its floor on the project brand as a compile error", async () => {
    const root = makeProject();
    writeFile(
      "biac.config.ts",
      'export default { brand: { colors: { primary: { light: "#154886", dark: "#60a5fa" } } } };\n',
    );
    writeFile(
      "pages/index.md",
      '---\nbrand:\n  colors:\n    background: { light: "#3b5c99", dark: "#0a0a0a" }\n---\n# Hi\n',
    );
    const dev = await makeServer(root);

    const result = await dev.transformRequest(
      `/@fs${join(root, "pages/index.md")}`,
    );

    expect(result?.code).toMatch(
      /^export const compileError = \{"file":"pages\/index\.md","message":"Invalid front-matter in pages\/index\.md — brand\.colors\.background\.light: #3b5c99 against --primary #154886 measures 1\.37:1/,
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

  it("invalidates the page module that reads a query file when the file is edited", async () => {
    const root = makeProject();
    const pagePath = join(root, "pages/index.md");
    writeFile("queries/totals.sql", "select 'before' as x\n");
    writeFile("pages/index.md", '# Hi\n\n<Table data="/queries/totals" />\n');
    const dev = await makeServer(root);
    await dev.transformRequest(`/@fs${pagePath}`);
    await waitForWatch(dev, join(root, "queries"), "totals.sql");

    await expectInvalidated(pageModule(dev, pagePath), () =>
      writeFile("queries/totals.sql", "select 'after' as x\n"),
    );

    const result = await dev.transformRequest(`/@fs${pagePath}`);
    expect(result?.code).toContain("select 'after' as x");
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

  it("invalidates the manifest when a page's chrome switch is edited, so the shell redraws it", async () => {
    const root = makeProject();
    writeFile("pages/embed.md", "---\nsidebar: false\n---\n# Hi\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "embed.md");
    expect(await loadManifest(dev)).toContain("sidebar: false");

    await expectInvalidated(manifestModule(dev), () =>
      writeFile(
        "pages/embed.md",
        "---\nsidebar: false\nheader: false\n---\n# Hi\n",
      ),
    );

    expect(await loadManifest(dev)).toContain("sidebar: false, header: false");
  });

  it("invalidates the manifest when a page's icon is edited, so the sidebar redraws it", async () => {
    const root = makeProject();
    writeFile("pages/index.md", "---\nicon: house\n---\n# Hi\n");
    const dev = await makeServer(root);
    await waitForWatch(dev, join(root, "pages"), "index.md");
    await loadManifest(dev);

    await expectInvalidated(manifestModule(dev), () =>
      writeFile("pages/index.md", "---\nicon: calendar\n---\n# Hi\n"),
    );

    expect(await loadManifest(dev)).toContain(
      '{"name":"Home","href":"/","icon":"calendar"}',
    );
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

  it("serves the project's layout declared in biac.config.ts", async () => {
    const root = makeProject();
    writeFile(
      "biac.config.ts",
      'export default { layout: { page_width: "full", cards: true, table_of_contents: false, table_of_contents_label: "Contents" } };\n',
    );
    const dev = await makeServer(root);

    const code = await loadConfigModule(dev);

    expect(code).toContain(
      '"layout":{"page_width":"full","cards":true,"table_of_contents":false,"table_of_contents_label":"Contents"}',
    );
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
    expect(code).toContain(
      '"layout":{"page_width":"article","cards":false,"table_of_contents":true,"table_of_contents_label":"On this page"}',
    );
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

  it("injects the brand colours as the body's first element, after every head stylesheet", async () => {
    const root = makeProject();
    writeFile(
      "biac.config.ts",
      'export default { brand: { colors: { primary: { light: "#154886", dark: "#60a5fa" } } } };\n',
    );
    const dev = await makeServer(root);

    const html = await dev.transformIndexHtml(
      "/",
      '<html><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div></body></html>',
    );

    const body = html.slice(html.indexOf("<body>"));
    expect(body).toMatch(
      /^<body>\s*<style>:root,\n\.light \{\n {2}--primary: #154886;\n\}\n\.dark \{\n {2}--primary: #60a5fa;\n\}\n<\/style>\s*<div id="root">/,
    );
  });

  it.each([
    [
      "the brand palette over the series tokens of its mode",
      'palette: { light: ["#1e40af"], dark: ["#60a5fa"] }',
      ":root,\n.light {\n  --chart-1: #1e40af;\n}\n.dark {\n  --chart-1: #60a5fa;\n}\n",
    ],
    [
      "the brand scale as one ramp token per mode",
      'scale: { light: ["#1e40af"], dark: ["#0a0a0a", "#60a5fa"] }',
      ":root,\n.light {\n  --chart-scale: #1e40af;\n}\n.dark {\n  --chart-scale: #0a0a0a, #60a5fa;\n}\n",
    ],
    [
      "the brand delta tones over --positive and --negative",
      'colors: { positive: { light: "#047857", dark: "#34d399" }, negative: { light: "#b91c1c", dark: "#f87171" } }',
      ":root,\n.light {\n  --positive: #047857;\n  --negative: #b91c1c;\n}\n.dark {\n  --positive: #34d399;\n  --negative: #f87171;\n}\n",
    ],
    [
      "the brand field and sidebar surfaces over --field and --sidebar",
      'colors: { field: { light: "#f8fafc", dark: "#1e293b" }, sidebar: { light: "#f1f5f9", dark: "#0f172a" } }',
      ":root,\n.light {\n  --field: #f8fafc;\n  --sidebar: #f1f5f9;\n}\n.dark {\n  --field: #1e293b;\n  --sidebar: #0f172a;\n}\n",
    ],
    [
      "the brand fonts over the font tokens, once for both modes",
      'fonts: { body: "serif", heading: "sans-serif", code: "mono" }',
      ":root {\n  --body-font: var(--font-stack-serif);\n  --heading-font: var(--font-stack-sans-serif);\n  --code-font: var(--font-stack-mono);\n}\n",
    ],
    [
      "the brand root font size as a percentage of the browser's default",
      'fontSize: "18px"',
      ":root {\n  font-size: 112.5%;\n}\n",
    ],
    [
      "the brand corner radius over --radius",
      'radius: "0"',
      ":root {\n  --radius: 0;\n}\n",
    ],
  ])("injects %s", async (_what, brand, css) => {
    const root = makeProject();
    writeFile("biac.config.ts", `export default { brand: { ${brand} } };\n`);
    const dev = await makeServer(root);

    const html = await dev.transformIndexHtml(
      "/",
      "<html><head></head><body></body></html>",
    );

    expect(html).toContain(`<style>${css}</style>`);
  });

  it("injects no brand style when the project sets no brand colour", async () => {
    const root = makeProject();
    const dev = await makeServer(root);

    const html = await dev.transformIndexHtml(
      "/",
      "<html><head></head><body></body></html>",
    );

    expect(html).not.toContain("<style>");
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

/**
 * Records the client's full-reload sends and runs `act` inside the first —
 * the moment the plugin has handled a reported config write.
 */
function recordFullReloads(dev: ViteDevServer, act: () => void): string[] {
  const reloads: string[] = [];
  const send = vi.spyOn(dev.environments.client.hot, "send");
  // `send` is overloaded (a payload object, or an event name and data);
  // only the object form carries a `type`.
  send.mockImplementation((...args: unknown[]) => {
    const [payload] = args as [{ type?: string } | string];
    if (typeof payload !== "object" || payload.type !== "full-reload") return;
    reloads.push(payload.type);
    if (reloads.length === 1) act();
  });
  return reloads;
}

describe("config writes the watcher drops", () => {
  it("reloads for a biac.config.ts write inside the watcher's throttle window", async () => {
    // Arrange
    const root = makeProject();
    const configFile = join(root, "biac.config.ts");
    writeFile("biac.config.ts", 'export default { title: "First" };\n');
    const dev = await makeServer(root);
    await waitForWatch(dev, root, "biac.config.ts");
    await loadConfigModule(dev);
    // chokidar drops a second change for one path within 50 ms of the first;
    // unwatching before the write stands in for that drop without racing it.
    const reloads = recordFullReloads(dev, () => {
      dev.watcher.unwatch(configFile);
      writeFileSync(configFile, 'export default { title: "Third" };\n');
    });

    // Act
    await expectInvalidated(configModule(dev), () =>
      writeFileSync(configFile, 'export default { title: "Second" };\n'),
    );

    // Assert
    await vi.waitFor(() => expect(reloads).toHaveLength(2), {
      timeout: WATCH_WAIT_MS,
    });
    expect(await loadConfigModule(dev)).toContain('"Third"');
  });
});
