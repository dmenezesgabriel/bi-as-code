import { compile } from "@mdx-js/mdx";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "@/cli/commands/build.js";
import { CONFIG_KEYS } from "@/engine/biac-config.js";
import { BRAND_KEYS } from "@/engine/brand-config.js";
import { DEFAULT_INTERPRETERS } from "@/engine/data-loader-interpreters.js";
import {
  createDataLoaderCache,
  type DataLoaderLog,
} from "@/engine/data-loader.js";
import { diskQueryFiles } from "@/engine/disk-query-files.js";
import { PAGE_ICON_NAMES } from "@/engine/page-icon-frontmatter.js";
import { remarkQueryFiles } from "@/engine/query-files.js";
import { parseSqlFenceMeta } from "@/engine/sql-fence-meta.js";
import {
  assertNoSqlTableCollision,
  sqlTableMap,
} from "@/engine/sql-frontmatter.js";
import type { DataLoaderInterpreters } from "@/engine/types.js";
import { copyDocsProject } from "../lib/shipped-project.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjects();
});

describe("the docs project", () => {
  it("builds with every internal link resolved and its data copied", async () => {
    // Arrange — a copy, so the build never writes into the repo's docs/.
    const root = makeTempProject("biac-docs-");
    copyDocsProject(root);
    writeFileSync(
      join(root, "queries/never_read.sql"),
      "select 'never-shipped-probe'\n",
    );
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
      "sql/params-in-queries",
      "sql/query-files",
      "sql/data-loaders",
    ]) {
      expect(existsSync(join(outDir, route, "index.html"))).toBe(true);
    }
    expect(existsSync(join(outDir, "data", "penguins.csv"))).toBe(true);
    expect(existsSync(join(outDir, "data", "seattle-weather.csv"))).toBe(true);
    expect(existsSync(join(outDir, "data", "island-summary.csv"))).toBe(true);
    expect(existsSync(join(outDir, "data", "island-summary.csv.js"))).toBe(
      false,
    );
    expect(filesCarrying(outDir, "island_counts").length).toBeGreaterThan(0);
    expect(filesCarrying(outDir, "never-shipped-probe")).toEqual([]);
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

  it("quotes the query-file errors on the Query files reference verbatim", async () => {
    // Arrange — the page is read from the repo; nothing is built.
    const page = readFileSync(
      new URL("../../docs/pages/sql/query-files.md", import.meta.url),
      "utf-8",
    );

    // Act
    const missing = await queryFileError(
      '<Table data="/queries/island_count" />\n',
    );
    const outside = await queryFileError('<Table data="/island_counts" />\n');

    // Assert — a paraphrased message would send a reader to search for text the build never prints.
    expect(missing).toContain("did you mean /queries/island_counts?");
    expect(page).toContain(missing);
    expect(page).toContain(outside);
  });

  it("quotes the data-loader errors and the terminal line on the Data loaders reference verbatim", async () => {
    // Arrange — the page is read from the repo; the loaders run in scratch projects.
    const page = readFileSync(
      new URL("../../docs/pages/sql/data-loaders.md", import.meta.url),
      "utf-8",
    );
    const exited = await loaderFailure({
      "data/quakes.csv.js":
        'console.error("upstream timed out"); process.exit(3);\n',
    });
    const missing = await loaderFailure(
      { "data/quakes.csv.sh": "echo a\n" },
      { ...DEFAULT_INTERPRETERS, ".sh": ["no-such-tool"] },
    );
    const twice = await loaderFailure({
      "data/quakes.csv.js": "console.log(1)\n",
      "data/quakes.csv.py": "print(1)\n",
    });

    // Act
    const unquoted = [exited, missing, twice].filter(
      (message) => !page.includes(message),
    );

    // Assert — a paraphrased message would send a reader to search for text biac never prints.
    expect(unquoted).toEqual([]);
  });

  it("quotes the terminal line a finished loader run prints", async () => {
    // Arrange — a copy, so the cache never writes `.biac/` into the repo's docs/.
    const root = makeTempProject("biac-docs-");
    copyDocsProject(root);
    const log = new FinishedRunLog();
    const page = readFileSync(
      new URL("../../docs/pages/sql/data-loaders.md", import.meta.url),
      "utf-8",
    );

    // Act
    await createDataLoaderCache(root, log).load(
      "island-summary.csv",
      DEFAULT_INTERPRETERS,
    );

    // Assert — the number of milliseconds varies, so only the line up to it is compared.
    const [line] = log.runs;
    expect(line).toMatch(
      /^data loader data\/island-summary\.csv\.js → \d+ bytes in \d+ ms$/,
    );
    expect(page).toContain(line!.replace(/ in \d+ ms$/, " in "));
  });
});

/** Keeps the lines a loader cache reports as finished runs. */
class FinishedRunLog implements DataLoaderLog {
  readonly runs: string[] = [];
  info(line: string): void {
    this.runs.push(line);
  }
  error(): void {}
  stderr(): void {}
}

/** The message of the failure `load` raises for `files` in a scratch project. */
async function loaderFailure(
  files: Record<string, string>,
  interpreters: DataLoaderInterpreters = DEFAULT_INTERPRETERS,
): Promise<string> {
  const root = makeTempProject("biac-loader-");
  for (const [name, content] of Object.entries(files)) {
    writeProjectFile(root, name, content);
  }
  const cache = createDataLoaderCache(root, new FinishedRunLog());
  try {
    await cache.load("quakes.csv", interpreters);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error(
    `loading quakes.csv in ${root} raised no error; expected one`,
  );
}

/** The files under `dir` whose text holds `text`. */
function filesCarrying(dir: string, text: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" }).filter(
    (name) =>
      statSync(join(dir, name)).isFile() &&
      readFileSync(join(dir, name), "utf8").includes(text),
  );
}

/** The reason the engine fails `markdown` against the docs project's `queries/`. */
async function queryFileError(markdown: string): Promise<string> {
  const docsRoot = new URL("../../docs", import.meta.url).pathname;
  try {
    await compile(markdown, {
      format: "mdx",
      remarkPlugins: [[remarkQueryFiles, diskQueryFiles(docsRoot), []]],
    });
  } catch (error) {
    return (error as { reason: string }).reason;
  }
  throw new Error(`compiling ${markdown} raised no error; expected one`);
}

function thrownMessage(action: () => void): string {
  try {
    action();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected the action to throw, but it returned");
}
