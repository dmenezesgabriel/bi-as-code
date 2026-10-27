import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "@/cli/commands/build.js";
import { cleanupProjects, makeTempProject } from "../lib/temp-project.js";

const docsRoot = fileURLToPath(new URL("../../docs/", import.meta.url));

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjects();
});

describe("the docs project", () => {
  it("builds with every internal link resolved and its data copied", async () => {
    // Arrange — a copy, so the build never writes into the repo's docs/.
    const root = makeTempProject("biac-docs-");
    cpSync(docsRoot, root, {
      recursive: true,
      filter: (source) => !source.startsWith(join(docsRoot, "build")),
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    // Act — build rejects on a broken internal link, so resolving is the check.
    await build([root]);

    // Assert
    const outDir = join(root, "build");
    expect(existsSync(join(outDir, "index.html"))).toBe(true);
    expect(existsSync(join(outDir, "getting-started", "index.html"))).toBe(
      true,
    );
    expect(existsSync(join(outDir, "data", "penguins.csv"))).toBe(true);
    expect(existsSync(join(outDir, "data", "seattle-weather.csv"))).toBe(true);
  }, 120_000);
});
