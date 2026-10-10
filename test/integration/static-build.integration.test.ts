import { readdirSync, readFileSync } from "node:fs";
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
  }, 120_000);
});
