import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "@/cli/commands/build.js";
import { CONFIG_KEYS } from "@/engine/biac-config.js";
import { PAGE_ICON_NAMES } from "@/engine/page-icon-frontmatter.js";
import { copyDocsProject } from "../lib/shipped-project.js";
import { cleanupProjects, makeTempProject } from "../lib/temp-project.js";

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjects();
});

describe("the docs project", () => {
  it("builds with every internal link resolved and its data copied", async () => {
    // Arrange — a copy, so the build never writes into the repo's docs/.
    const root = makeTempProject("biac-docs-");
    copyDocsProject(root);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    // Act — build rejects on a broken internal link, so resolving is the check.
    await build([root]);

    // Assert
    const outDir = join(root, "build");
    for (const route of [
      "",
      "getting-started",
      "components/table",
      "components/big-value",
      "components/value",
      "pages/markdown-pages",
      "pages/biac-config",
      "pages/sidebar-contents-breadcrumbs",
    ]) {
      expect(existsSync(join(outDir, route, "index.html"))).toBe(true);
    }
    expect(existsSync(join(outDir, "data", "penguins.csv"))).toBe(true);
    expect(existsSync(join(outDir, "data", "seattle-weather.csv"))).toBe(true);
  }, 120_000);

  it("lists every icon name the front-matter accepts on the Markdown pages reference", () => {
    // Arrange — the page is read from the repo; nothing is built.
    const page = readFileSync(
      new URL("../../docs/pages/pages/markdown-pages.md", import.meta.url),
      "utf-8",
    );

    // Act
    const unlisted = PAGE_ICON_NAMES.filter(
      (name) => !page.includes(`\`${name}\``),
    );

    // Assert — a catalog name the page omits would send a reader to the error message.
    expect(unlisted).toEqual([]);
  });

  it("lists every biac.config.ts key on the config reference", () => {
    // Arrange — the page is read from the repo; nothing is built.
    const page = readFileSync(
      new URL("../../docs/pages/pages/biac-config.md", import.meta.url),
      "utf-8",
    );

    // Act
    const unlisted = CONFIG_KEYS.filter((key) => !page.includes(`\`${key}\``));

    // Assert — a key the page omits would leave a reader with only the error message.
    expect(unlisted).toEqual([]);
  });
});
