import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { WEB_CONFIG } from "@/cli/commands/web-project.js";

const EDITOR_DIR = fileURLToPath(
  new URL("../../src/web/src/features/editor/", import.meta.url),
);
// `editable-page.tsx` reaches the editor only through this lazy `import()`.
const LAZY_EDITOR_URL = "/src/features/editor/page-editor.tsx";
// A crawl entry that never reaches the editor — the state of a dep cache
// written before the lazy edge was ever followed.
const ENTRY_WITHOUT_EDITOR = "src/lib/cn.ts";
// Cold optimizer runs bundle react and codemirror from scratch.
const OPTIMIZER_WAIT_MS = 60_000;

// The throwaway dep cache goes on disk: the temp dir may be tmpfs (RAM).
const cacheParent = fileURLToPath(
  new URL("../../node_modules/.cache/", import.meta.url),
);
// vite declares `DepsOptimizer` without exporting it.
type DepsOptimizer = NonNullable<
  ViteDevServer["environments"]["client"]["depsOptimizer"]
>;

let cacheDir: string;
let dev: ViteDevServer;

function clientOptimizer(): DepsOptimizer {
  const optimizer = dev.environments.client.depsOptimizer;
  if (!optimizer) throw new Error("expected a client depsOptimizer, got none");
  return optimizer;
}

/** Waits until the startup batch has committed and nothing awaits bundling. */
async function waitForOptimizerIdle(): Promise<void> {
  await clientOptimizer().scanProcessing;
  await vi.waitFor(
    () => {
      // `metadata` is replaced on each commit — read it fresh every time.
      const { discovered, optimized } = clientOptimizer().metadata;
      expect(Object.keys(discovered)).toEqual([]);
      expect(Object.keys(optimized)).not.toEqual([]);
    },
    { timeout: OPTIMIZER_WAIT_MS, interval: 100 },
  );
}

/** Transforms `url` and every editor module it reaches, as the browser would. */
async function transformEditorGraph(
  url: string,
  seen = new Set<string>(),
): Promise<void> {
  if (seen.has(url)) return;
  seen.add(url);
  await dev.transformRequest(url);
  const node = await dev.moduleGraph.getModuleByUrl(url);
  for (const mod of node?.importedModules ?? []) {
    if (mod.file?.startsWith(EDITOR_DIR)) {
      await transformEditorGraph(mod.url, seen);
    }
  }
}

beforeAll(async () => {
  mkdirSync(cacheParent, { recursive: true });
  cacheDir = mkdtempSync(join(cacheParent, "lazy-editor-deps-"));
  dev = await createServer({
    configFile: WEB_CONFIG,
    cacheDir,
    logLevel: "error",
    server: { middlewareMode: true },
    optimizeDeps: { entries: [ENTRY_WITHOUT_EDITOR] },
  });
}, OPTIMIZER_WAIT_MS);

afterAll(async () => {
  await dev?.close();
  rmSync(cacheDir, { recursive: true, force: true });
});

describe("biac dev dep optimizer", () => {
  it(
    "serves the lazily loaded editor with no runtime dep discovery when the crawl missed it",
    async () => {
      // Arrange
      await waitForOptimizerIdle();

      // Act
      await transformEditorGraph(LAZY_EDITOR_URL);

      // Assert
      const { discovered, optimized } = clientOptimizer().metadata;
      expect(
        Object.keys(discovered),
        "discovered at runtime — add to optimizeDeps.include in src/web/vite.config.ts",
      ).toEqual([]);
      expect(Object.keys(optimized)).toEqual(
        expect.arrayContaining(dev.config.optimizeDeps.include ?? []),
      );
    },
    2 * OPTIMIZER_WAIT_MS,
  );
});
