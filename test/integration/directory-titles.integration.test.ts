import { writeFileSync } from "node:fs";
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
const TITLED_NESTED =
  'export default {\n  directories: {\n    "pages/nested": { title: "Planning" },\n  },\n};\n';

let server: ViteDevServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
  cleanupProjects();
});

// A watch test waits up to 10s for chokidar; vitest's 5s default would
// kill it first on a loaded host.
vi.setConfig({ testTimeout: 20_000 });

async function serveProject(config: string): Promise<{
  root: string;
  dev: ViteDevServer;
}> {
  const root = makeTempProject("biac-directories-");
  writeProjectFile(root, "pages/index.md", "# Home\n");
  writeProjectFile(root, "pages/nested/page.md", "# Nested\n");
  writeProjectFile(root, "biac.config.ts", config);
  server = await makePagesServer(root);
  return { root, dev: server };
}

async function transformed(dev: ViteDevServer, id: string): Promise<string> {
  return (await dev.transformRequest(id))?.code ?? "";
}

describe("directories in biac.config.ts", () => {
  it("names the sidebar folder in the served nav tree", async () => {
    const { dev } = await serveProject(TITLED_NESTED);

    const manifest = await transformed(dev, VIRTUAL_MANIFEST_ID);

    expect(manifest).toContain('"id":"nested","name":"Planning"');
  });

  it("keeps the titles out of the browser config module", async () => {
    const { dev } = await serveProject(TITLED_NESTED);

    const config = await transformed(dev, VIRTUAL_CONFIG_ID);

    expect(config).not.toContain("directories");
  });

  it("rejects a key with no page under it, with vite's id and the key's loc", async () => {
    const { root, dev } = await serveProject(
      TITLED_NESTED.replace("pages/nested", "pages/nestd"),
    );
    const file = join(root, "biac.config.ts");

    const error = await dev
      .transformRequest(VIRTUAL_MANIFEST_ID)
      .catch((thrown: unknown) => thrown);

    expect(error).toMatchObject({
      message:
        "Invalid biac.config.ts:3:5 — directories.pages/nestd: unknown key, expected one of pages/nested (did you mean pages/nested?)",
      id: file,
      loc: { file, line: 3, column: 5 },
    });
  });

  it("invalidates the manifest when biac.config.ts is edited", async () => {
    const { root, dev } = await serveProject("export default {};\n");
    await waitForWatch(dev, root, "biac.config.ts");
    await transformed(dev, VIRTUAL_MANIFEST_ID);
    const manifest =
      dev.environments.client.moduleGraph.getModuleById(RESOLVED_MANIFEST_ID);

    await expectInvalidated(manifest, () =>
      writeFileSync(join(root, "biac.config.ts"), TITLED_NESTED),
    );

    expect(await transformed(dev, VIRTUAL_MANIFEST_ID)).toContain(
      '"name":"Planning"',
    );
  });
});
