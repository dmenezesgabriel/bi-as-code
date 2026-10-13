import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

/** Every file under `outDir`, however deep, whose bytes contain `needle`. */
function buildFilesContaining(outDir: string, needle: string): string[] {
  return readdirSync(outDir, { recursive: true, encoding: "utf8" }).filter(
    (name) => {
      const file = join(outDir, name);
      return statSync(file).isFile() && readFileSync(file).includes(needle);
    },
  );
}

function assetsContaining(outDir: string, needle: string): string[] {
  return buildFilesContaining(join(outDir, "assets"), needle).filter((name) =>
    name.endsWith(".js"),
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

  it("ships no page editor and no page-source client", async () => {
    const root = makeTempProject();
    writeProjectFile(root, "pages/index.md", `# ${PAGE_MARKER}\n`);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build([root]);

    // The editor and its write path exist only under `biac dev`: a static
    // host has no endpoint to save to, so neither CodeMirror's bytes nor
    // the endpoint's URL may reach the output. vitest runs with
    // NODE_ENV=test, so this build has `import.meta.env.DEV` true — the
    // exclusion must not depend on it.
    const outDir = join(root, "build");
    expect(buildFilesContaining(outDir, "codemirror")).toEqual([]);
    expect(buildFilesContaining(outDir, "/__biac/page-source/")).toEqual([]);
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

  it("fails on a page that does not compile, naming the page", async () => {
    const root = makeTempProject();
    writeProjectFile(root, "pages/index.md", "# Hi\n\n<Callout\n");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(build([root])).rejects.toThrow(/pages\/index\.md/);
    expect(existsSync(join(root, "build", "index.html"))).toBe(false);
  }, 120_000);

  it("fails on a page naming a filter with the editor's URL key, at the attribute", async () => {
    const root = makeTempProject();
    const page = '# Hi\n\n<Table data="orders" filters="edit" />\n';
    writeProjectFile(root, "pages/index.md", page);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const failure = await build([root]).catch((error: unknown) => error);

    expect(String(failure)).toMatch(
      /pages\/index\.md:3:22[^]*Reserved filter id "edit" on <Table filters>/,
    );
    expect(existsSync(join(root, "build", "index.html"))).toBe(false);
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
