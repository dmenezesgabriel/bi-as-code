import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "@/cli/commands/build.js";
import { CONFIG_KEYS } from "@/engine/biac-config.js";
import { BRAND_KEYS } from "@/engine/brand-config.js";
import { PAGE_ICON_NAMES } from "@/engine/page-icon-frontmatter.js";
import { parseSqlFenceMeta } from "@/engine/sql-fence-meta.js";
import {
  assertNoSqlTableCollision,
  sqlTableMap,
} from "@/engine/sql-frontmatter.js";
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
      "pages/themes-and-brand",
      "pages/branded-page-example",
      "sql/sql-tables-and-fences",
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

  it("names every brand key on the themes reference and lists brand among the front-matter keys", () => {
    // Arrange — the pages are read from the repo; nothing is built.
    const read = (name: string) =>
      readFileSync(
        new URL(`../../docs/pages/pages/${name}.md`, import.meta.url),
        "utf-8",
      );
    const themes = read("themes-and-brand");
    const frontMatterRows = read("markdown-pages")
      .split("\n")
      .filter((line) => line.startsWith("| `"));

    // Act
    const unnamed = BRAND_KEYS.filter((key) => !themes.includes(`\`${key}\``));

    // Assert — a key the page omits would leave a reader with only the error message.
    expect(unnamed).toEqual([]);
    expect(frontMatterRows.some((row) => row.startsWith("| `brand`"))).toBe(
      true,
    );
  });

  it("quotes every sql: and sql fence error on the SQL reference and lists sql among the front-matter keys", () => {
    // Arrange — the pages are read from the repo; nothing is built.
    const read = (path: string) =>
      readFileSync(
        new URL(`../../docs/pages/${path}.md`, import.meta.url),
        "utf-8",
      );
    const page = read("sql/sql-tables-and-fences");
    const front = "front-matter in pages/sales.md";
    const fence = "pages/sales.md:12";
    const messages = [
      thrownMessage(() => sqlTableMap({ sales: "data/a.txt" }, front)),
      thrownMessage(() => sqlTableMap({ sales: 3 }, front)),
      thrownMessage(() => sqlTableMap("data/a.csv", front)),
      thrownMessage(() =>
        assertNoSqlTableCollision(
          { sales: "data/b.csv" },
          { sales: "data/a.csv" },
          front,
        ),
      ),
      thrownMessage(() => parseSqlFenceMeta("sales shown", fence)),
      thrownMessage(() => parseSqlFenceMeta("sales echo=maybe", fence)),
      thrownMessage(() => parseSqlFenceMeta("echo sales", fence)),
      thrownMessage(() => parseSqlFenceMeta("/sales", fence)),
    ];
    const frontMatterRows = read("pages/markdown-pages")
      .split("\n")
      .filter((line) => line.startsWith("| `"));

    // Act
    const unquoted = messages.filter((message) => !page.includes(message));

    // Assert — a paraphrased message would send a reader to search for text the build never prints.
    expect(unquoted).toEqual([]);
    expect(frontMatterRows.some((row) => row.startsWith("| `sql`"))).toBe(true);
  });
});

function thrownMessage(action: () => void): string {
  try {
    action();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected the action to throw, but it returned");
}
