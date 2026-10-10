import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "@/cli/commands/build.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

// A string only the page source contains — finding it in an emitted chunk
// proves the page compiled into the bundle, not just the SPA shell.
const PAGE_MARKER = "static-build-marker-7f3a";
const CSV = "id,region,amount\n1,West,10\n2,East,20\n";
const PARQUET_STUB = Buffer.from([0x50, 0x41, 0x52, 0x31, 0xde, 0xad]);

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjects();
});

function assetsContaining(outDir: string, needle: string): string[] {
  const assets = join(outDir, "assets");
  return readdirSync(assets).filter(
    (name) =>
      name.endsWith(".js") &&
      readFileSync(join(assets, name), "utf8").includes(needle),
  );
}

describe("biac build", () => {
  it("writes the SPA shell and compiled page chunks to <project>/build", async () => {
    const root = makeTempProject();
    writeProjectFile(root, "pages/index.md", `# ${PAGE_MARKER}\n`);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build([root]);

    const outDir = join(root, "build");
    const html = readFileSync(join(outDir, "index.html"), "utf8");
    expect(html).toContain("__BIAC_THEME__");
    expect(html).toContain('id="root"');
    expect(assetsContaining(outDir, PAGE_MARKER)).toHaveLength(1);
    // The manifest's dev-only HMR accept list spells page ids out as
    // literals; their absence proves the `import.meta.hot` block was dropped.
    expect(assetsContaining(outDir, "virtual:biac-page/")).toEqual([]);
  }, 120_000);

  it("copies data/ byte-identical into build/data, nested dirs included", async () => {
    const root = makeTempProject();
    writeProjectFile(root, "pages/index.md", "# Data\n");
    writeProjectFile(root, "data/orders.csv", CSV);
    writeProjectFile(root, "data/nested/deep/stub.parquet", PARQUET_STUB);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build([root]);

    const outData = join(root, "build", "data");
    expect(readFileSync(join(outData, "orders.csv"), "utf8")).toBe(CSV);
    expect(readFileSync(join(outData, "nested/deep/stub.parquet"))).toEqual(
      PARQUET_STUB,
    );
  }, 120_000);

  it("builds without a data/ directory and emits no build/data", async () => {
    const root = makeTempProject();
    writeProjectFile(root, "pages/index.md", "# No data\n");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build([root]);

    expect(existsSync(join(root, "build", "index.html"))).toBe(true);
    expect(existsSync(join(root, "build", "data"))).toBe(false);
  }, 120_000);
});
