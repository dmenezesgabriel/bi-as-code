import { rmSync } from "node:fs";
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

const VIRTUAL_TRANSLATIONS_ID = "virtual:biac-translations";
const RESOLVED_TRANSLATIONS_ID = "\0virtual:biac-translations";
const TRANSLATIONS = "en:\n  revenue: Revenue\nfr:\n  revenue: Revenu\n";
const PAGE = "# {$translations.revenue}\n";

let server: ViteDevServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
  cleanupProjects();
});

/** How long a filesystem mutation may take to reach vite's watcher. */
const WATCH_WAIT_MS = 10_000;

// Every test boots a vite dev server, and a watch test then waits up to
// WATCH_WAIT_MS for its event.
vi.setConfig({ testTimeout: 2 * WATCH_WAIT_MS });

async function serveProject(
  files: Record<string, string>,
): Promise<{ root: string; dev: ViteDevServer }> {
  const root = makeTempProject();
  for (const [path, content] of Object.entries(files)) {
    writeProjectFile(root, path, content);
  }
  server = await makePagesServer(root);
  return { root, dev: server };
}

async function transformed(dev: ViteDevServer, id: string): Promise<string> {
  return (await dev.transformRequest(id))?.code ?? "";
}

describe("virtual:biac-translations", () => {
  it("serves every declared language resolved, the en fallback applied", async () => {
    const { dev } = await serveProject({
      "translations.yaml": "en:\n  a: A\n  b: B\nfr:\n  a: A fr\n",
    });

    const code = await transformed(dev, VIRTUAL_TRANSLATIONS_ID);

    expect(code).toContain('export const languages = ["en","fr"];');
    expect(code).toContain(
      'export const translations = {"en":{"a":"A","b":"B"},"fr":{"a":"A fr","b":"B"}};',
    );
  });

  it("serves no languages for a project without translations.yaml", async () => {
    const { dev } = await serveProject({});

    const code = await transformed(dev, VIRTUAL_TRANSLATIONS_ID);

    expect(code).toContain("export const languages = [];");
  });

  it("rejects a malformed file with vite's id and the line's loc", async () => {
    const { root, dev } = await serveProject({
      "translations.yaml": "en:\n  a: 1\n b: 2\n",
    });

    await expect(
      dev.transformRequest(VIRTUAL_TRANSLATIONS_ID),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/^Invalid translations\.yaml:3:\d+ — /),
      loc: { file: join(root, "translations.yaml"), line: 3 },
    });
  });
});

describe("a page reading $translations", () => {
  it("imports the translations module", async () => {
    const { root, dev } = await serveProject({
      "translations.yaml": TRANSLATIONS,
      "pages/index.md": PAGE,
    });

    const code = await transformed(dev, `/@fs${join(root, "pages/index.md")}`);

    expect(code).toContain("virtual:biac-translations");
  });

  it("serves an unknown key as a compile error at its position", async () => {
    const { root, dev } = await serveProject({
      "translations.yaml": TRANSLATIONS,
      "pages/index.md": "\n# {$translations.revenu}\n",
    });

    const code = await transformed(dev, `/@fs${join(root, "pages/index.md")}`);

    expect(code).toBe(
      'export const compileError = {"file":"pages/index.md","message":"Undefined translation key: $translations.revenu (did you mean $translations.revenue?)","line":2,"column":4};\n',
    );
  });

  it("serves a malformed translations.yaml as the page's compile error", async () => {
    const { root, dev } = await serveProject({
      "translations.yaml": "en:\n  a: 1\n b: 2\n",
      "pages/index.md": PAGE,
    });

    const code = await transformed(dev, `/@fs${join(root, "pages/index.md")}`);

    expect(code).toMatch(/"message":"Invalid translations\.yaml:3:\d+ — /);
  });

  it("compiles a page without $translations despite a malformed file", async () => {
    const { root, dev } = await serveProject({
      "translations.yaml": "en:\n  a: 1\n b: 2\n",
      "pages/index.md": "# Plain\n",
    });

    const code = await transformed(dev, `/@fs${join(root, "pages/index.md")}`);

    expect(code).not.toContain("compileError");
  });
});

describe("a project without translations.yaml", () => {
  it("serves a page that fails to compile as its own compile error", async () => {
    const { root, dev } = await serveProject({
      "pages/index.md": "---\npage_width: wide\n---\n# Hi\n",
    });

    const code = await transformed(dev, `/@fs${join(root, "pages/index.md")}`);

    expect(code).toMatch(/^export const compileError = .*page_width/);
  });

  it("recompiles a page naming a key once the file is created", async () => {
    const { root, dev } = await serveProject({ "pages/index.md": PAGE });
    const pagePath = join(root, "pages/index.md");
    expect(await transformed(dev, `/@fs${pagePath}`)).toContain(
      "Undefined translation key: $translations.revenue",
    );
    const page = dev.environments.client.moduleGraph.getModuleById(pagePath)!;
    const before = page.lastInvalidationTimestamp;

    // The watcher registers a file that does not exist yet asynchronously,
    // with nothing to wait on, so each attempt re-creates the file: every
    // write is then a real creation.
    await vi.waitFor(
      () => {
        rmSync(join(root, "translations.yaml"), { force: true });
        writeProjectFile(root, "translations.yaml", TRANSLATIONS);
        expect(page.lastInvalidationTimestamp).toBeGreaterThan(before);
      },
      { timeout: WATCH_WAIT_MS, interval: 1_000 },
    );
    expect(await transformed(dev, `/@fs${pagePath}`)).not.toContain(
      "compileError",
    );
  });
});

describe("editing translations.yaml", () => {
  it("re-serves the translations module and the page that reads it", async () => {
    const { root, dev } = await serveProject({
      "translations.yaml": TRANSLATIONS,
      "pages/index.md": PAGE,
    });
    const pagePath = join(root, "pages/index.md");
    await transformed(dev, `/@fs${pagePath}`);
    await transformed(dev, VIRTUAL_TRANSLATIONS_ID);
    await waitForWatch(dev, root, "translations.yaml");
    const graph = dev.environments.client.moduleGraph;

    await expectInvalidated(graph.getModuleById(pagePath), () =>
      writeProjectFile(root, "translations.yaml", "en:\n  revenue: Turnover\n"),
    );

    expect(await transformed(dev, VIRTUAL_TRANSLATIONS_ID)).toContain(
      '{"en":{"revenue":"Turnover"}}',
    );
    expect(
      graph.getModuleById(RESOLVED_TRANSLATIONS_ID)?.lastHMRTimestamp,
    ).toBeGreaterThan(0);
  });

  it("re-checks a page's keys against the edited file", async () => {
    const { root, dev } = await serveProject({
      "translations.yaml": TRANSLATIONS,
      "pages/index.md": PAGE,
    });
    const pagePath = join(root, "pages/index.md");
    await transformed(dev, `/@fs${pagePath}`);
    await waitForWatch(dev, root, "translations.yaml");

    await expectInvalidated(
      dev.environments.client.moduleGraph.getModuleById(pagePath),
      () =>
        writeProjectFile(
          root,
          "translations.yaml",
          "en:\n  turnover: Turnover\n",
        ),
    );

    expect(await transformed(dev, `/@fs${pagePath}`)).toContain(
      "Undefined translation key: $translations.revenue",
    );
  });
});
