import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { NO_BRAND } from "./brand-config.js";
import { compilePage } from "./compile-page.js";
import { NO_QUERY_FILES } from "./query-files.js";
import type { QueryFiles, ResolvedTranslations } from "./types.js";

const compile = (markdown: string, filePath = "pages/page.md") =>
  compilePage(markdown, filePath);

let moduleDir: string | undefined;

afterEach(() => {
  if (moduleDir) rmSync(moduleDir, { recursive: true, force: true });
  moduleDir = undefined;
});

/**
 * Emitted page modules are real ESM — write `code` under `node_modules/.tmp/`
 * (gitignored, and the nearest `node_modules` ancestor resolves
 * `react/jsx-runtime`) and import it back.
 */
async function importCompiledModule(code: string): Promise<{
  default: unknown;
  frontmatter: unknown;
  title: unknown;
  sqlBlocks: unknown;
  sqlTables: unknown;
  layout: unknown;
  brandCss: unknown;
}> {
  const tmpParent = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../node_modules/.tmp",
  );
  mkdirSync(tmpParent, { recursive: true });
  moduleDir = mkdtempSync(join(tmpParent, "biac-page-"));
  const file = join(moduleDir, "page.mjs");
  writeFileSync(file, code);
  return import(pathToFileURL(file).href);
}

describe("front-matter", () => {
  it("parses the front-matter block into frontmatter", async () => {
    const page = await compile(
      "---\ntitle: Report\ndraft: true\n---\n# Body\n",
    );

    expect(page.frontmatter).toEqual({ title: "Report", draft: true });
  });

  it("yields an empty frontmatter object when the file has none", async () => {
    const page = await compile("# Just a heading\n");

    expect(page.frontmatter).toEqual({});
  });

  it("rejects on invalid YAML", async () => {
    await expect(compile("---\ntitle: [unclosed\n---\n")).rejects.toThrow();
  });

  it("rejects invalid YAML at its line and column in the file", async () => {
    const failure = await compile("---\ntitle: Weekly review: x\n---\n").catch(
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({ line: 2, column: 8 });
    expect((failure as Error).message).not.toMatch(/ at line 1/);
  });

  it("rejects front-matter that is not a YAML mapping", async () => {
    await expect(compile("---\n- a\n- b\n---\n")).rejects.toThrow(
      /expected a YAML mapping/,
    );
  });
});

describe("title", () => {
  it("prefers the front-matter title over the first h1", async () => {
    const page = await compile(
      "---\ntitle: From front matter\n---\n# From h1\n",
    );

    expect(page.title).toBe("From front matter");
  });

  it("falls back to the first h1 when no title key exists", async () => {
    const page = await compile("# Heading title\n\nprose\n");

    expect(page.title).toBe("Heading title");
  });

  it("treats an explicit null title as untitled, not as a fallback", async () => {
    const page = await compile("---\ntitle:\n---\n# Ignored h1\n");

    expect(page.title).toBeNull();
  });

  it("is null when neither front-matter nor h1 provide one", async () => {
    const page = await compile("plain prose\n");

    expect(page.title).toBeNull();
  });

  it("flattens inline markup in the h1 to plain text", async () => {
    const page = await compile("# Hello *world* `code`\n");

    expect(page.title).toBe("Hello world code");
  });

  it("skips an empty h1 and uses the next non-empty one", async () => {
    const page = await compile("#\n\n# Second\n");

    expect(page.title).toBe("Second");
  });
});

describe("sql blocks", () => {
  it("extracts a named sql fence into sqlBlocks", async () => {
    const page = await compile("```sql orders\nselect * from orders\n```\n");

    expect(page.sqlBlocks).toEqual([
      { name: "orders", sql: "select * from orders" },
    ]);
  });

  it("keeps an unnamed sql fence as a plain code block", async () => {
    const page = await compile("```sql\nselect 1\n```\n");

    expect(page.sqlBlocks).toEqual([]);
    expect(page.code).toContain("select 1");
  });

  it("trims the fence meta and ignores whitespace-only meta", async () => {
    const page = await compile(
      "```sql   \nselect 1\n```\n\n```sql   orders  \nselect 2\n```\n",
    );

    expect(page.sqlBlocks).toEqual([{ name: "orders", sql: "select 2" }]);
  });

  it("preserves declaration order across multiple named blocks", async () => {
    const page = await compile(
      "```sql a\nselect 1\n```\n\ntext\n\n```sql b\nselect 2\n```\n",
    );

    expect(page.sqlBlocks.map((b) => b.name)).toEqual(["a", "b"]);
  });

  it("rejects a duplicate block name naming the file and line", async () => {
    const markdown =
      "```sql orders\nselect 1\n```\n\n```sql orders\nselect 2\n```\n";

    await expect(compile(markdown, "pages/dup.md")).rejects.toThrow(
      /Duplicate sql block name "orders" at pages\/dup\.md:5/,
    );
  });

  it("carries a named fence's name onto the rendered code element", async () => {
    const page = await compile("```sql orders\nselect 1\n```\n");

    expect(page.code).toContain('meta: "orders"');
  });

  it("registers the name without its display flags", async () => {
    const page = await compile("```sql orders echo display\nselect 1\n```\n");

    expect(page.sqlBlocks).toEqual([{ name: "orders", sql: "select 1" }]);
  });

  it("detects a duplicate on the bare name across differing flags", async () => {
    const markdown =
      "```sql orders echo\nselect 1\n```\n\n```sql orders\nselect 2\n```\n";

    await expect(compile(markdown, "pages/dup.md")).rejects.toThrow(
      /Duplicate sql block name "orders" at pages\/dup\.md:5/,
    );
  });

  it("carries the flags that are on onto the rendered code element", async () => {
    const page = await compile("```sql orders echo display\nselect 1\n```\n");

    expect(page.code).toContain('meta: "orders"');
    expect(page.code).toContain('echo: ""');
    expect(page.code).toContain('display: ""');
  });

  it("emits no prop for a flag that is off", async () => {
    const page = await compile("```sql orders echo=false\nselect 1\n```\n");

    expect(page.code).not.toContain("echo:");
    expect(page.code).not.toContain("display:");
  });

  it("rejects an unknown fence attribute naming the file and line", async () => {
    const markdown = "# Orders\n\n```sql orders shwo\nselect 1\n```\n";

    await expect(compile(markdown, "pages/typo.md")).rejects.toThrow(
      /Unknown sql block attribute "shwo" at pages\/typo\.md:3/,
    );
  });

  it("emits no meta prop for an unnamed sql fence", async () => {
    const page = await compile("```sql\nselect 1\n```\n");

    expect(page.code).not.toContain("meta:");
  });
});

describe("query files", () => {
  const queryFiles: QueryFiles = {
    read: async (name) => (name === "totals.sql" ? "select 2" : undefined),
    list: async () => ["totals.sql"],
  };

  it("emits a file a widget's data names after the page's fences", async () => {
    const markdown =
      '```sql orders\nselect 1\n```\n\n<Table data="/queries/totals" />\n';

    const page = await compilePage(
      markdown,
      "pages/a.md",
      {},
      NO_BRAND,
      queryFiles,
    );
    const module = await importCompiledModule(page.code);

    expect(module.sqlBlocks).toEqual([
      { name: "orders", sql: "select 1" },
      { name: "/queries/totals", sql: "select 2" },
    ]);
  });

  it("fails a page naming a missing file at its line and column", async () => {
    const markdown = '# T\n\n<Table data="/queries/total" />\n';

    const failure = await compilePage(
      markdown,
      "pages/a.md",
      {},
      NO_BRAND,
      queryFiles,
    ).catch((error: unknown) => error);

    expect(failure).toMatchObject({
      message: expect.stringContaining("(did you mean /queries/totals?)"),
      file: "pages/a.md",
      line: 3,
      column: 8,
    });
  });
});

describe("translations", () => {
  const translations: ResolvedTranslations = {
    languages: ["en"],
    byLanguage: { en: { revenue: "Revenue" } },
  };
  const compileWithTranslations = (markdown: string) =>
    compilePage(
      markdown,
      "pages/a.md",
      {},
      NO_BRAND,
      NO_QUERY_FILES,
      async () => translations,
    );

  it("reports a page that reads $translations", async () => {
    const page = await compileWithTranslations("# {$translations.revenue}\n");

    expect(page.readsTranslations).toBe(true);
    expect(page.code).toContain('from "virtual:biac-translations"');
  });

  it("reports a page that does not, exporting no translations", async () => {
    const page = await compileWithTranslations("# Revenue\n");

    expect(page.readsTranslations).toBe(false);
    expect(page.code).not.toContain("translationsFor");
  });

  it("exports translationsFor from a page whose sql fence reads $translations", async () => {
    const page = await compileWithTranslations(
      "```sql q\nselect {{ $translations.revenue }}\n```\n",
    );

    expect(page.readsTranslations).toBe(true);
    expect(page.code).toContain(
      'export {translationsFor} from "virtual:biac-translations";',
    );
  });

  it("reports a page whose query file reads $translations", async () => {
    const queryFiles: QueryFiles = {
      read: async () => "select {{$translations.revenue}}",
      list: async () => ["labels.sql"],
    };

    const page = await compilePage(
      '<Table data="/queries/labels" />\n',
      "pages/a.md",
      {},
      NO_BRAND,
      queryFiles,
      async () => translations,
    );

    expect(page.readsTranslations).toBe(true);
  });

  it("fails an unknown key at its line in the file, front-matter included", async () => {
    const failure = await compileWithTranslations(
      "---\ntitle: T\n---\n\n# {$translations.revenu}\n",
    ).catch((error: unknown) => error);

    expect(failure).toMatchObject({
      message:
        "Undefined translation key: $translations.revenu (did you mean $translations.revenue?)",
      line: 5,
      column: 4,
    });
  });
});

describe("sql front-matter", () => {
  it("extracts the sql: key into sqlTables", async () => {
    const page = await compile(
      "---\nsql:\n  orders: data/orders.csv\n---\n# Body\n",
    );

    expect(page.sqlTables).toEqual({ orders: "data/orders.csv" });
  });

  it("yields an empty map when the page declares no sql key", async () => {
    const page = await compile("# Body\n");

    expect(page.sqlTables).toEqual({});
  });

  it("rejects a sql key that is not a name → path mapping", async () => {
    await expect(
      compile("---\nsql:\n  - data/orders.csv\n---\n# Body\n"),
    ).rejects.toThrow(/sql: expected a mapping/);
  });

  it("rejects a source outside data/ naming the page file", async () => {
    await expect(
      compile(
        "---\nsql:\n  orders: pages/orders.csv\n---\n# Body\n",
        "pages/a.md",
      ),
    ).rejects.toThrow(/pages\/a\.md/);
  });

  it("rejects a table name already declared by biac.config.ts", async () => {
    await expect(
      compilePage(
        "---\nsql:\n  orders: data/orders.csv\n---\n# Body\n",
        "pages/a.md",
        { orders: "data/shared.parquet" },
      ),
    ).rejects.toThrow(
      /Invalid front-matter in pages\/a\.md — sql\.orders:.*biac\.config\.ts/,
    );
  });

  it("compiles cleanly when page and config table names are disjoint", async () => {
    const page = await compilePage(
      "---\nsql:\n  orders: data/orders.csv\n---\n# Body\n",
      "pages/a.md",
      { other: "data/other.csv" },
    );

    expect(page.sqlTables).toEqual({ orders: "data/orders.csv" });
  });
});

describe("layout front-matter", () => {
  it("carries page_width into layout", async () => {
    const page = await compile("---\npage_width: full\n---\n# Body\n");

    expect(page.layout).toEqual({ page_width: "full" });
  });

  it("carries cards into layout", async () => {
    const page = await compile("---\ncards: true\n---\n# Body\n");

    expect(page.layout).toEqual({ cards: true });
  });

  it("rejects a non-boolean cards naming the page file", async () => {
    await expect(
      compile("---\ncards: yes please\n---\n# Body\n", "pages/a.md"),
    ).rejects.toThrow(
      'Invalid front-matter in pages/a.md — cards: expected a boolean, got "yes please"',
    );
  });

  it("leaves layout empty when the page sets no page_width", async () => {
    const page = await compile("# Body\n");

    expect(page.layout).toEqual({});
  });

  it("rejects a page_width outside article | full naming the page file", async () => {
    await expect(
      compile("---\npage_width: wide\n---\n# Body\n", "pages/a.md"),
    ).rejects.toThrow(
      'Invalid front-matter in pages/a.md — page_width: expected "article" | "full", got "wide"',
    );
  });
});

describe("icon front-matter", () => {
  it("compiles a page whose icon is a catalog name", async () => {
    const page = await compile("---\nicon: calendar\n---\n# Body\n");

    expect(page.frontmatter.icon).toBe("calendar");
  });

  it("rejects an icon outside the catalog naming the page file and the closest name", async () => {
    await expect(
      compile("---\nicon: calender\n---\n# Body\n", "pages/a.md"),
    ).rejects.toThrow(
      /^Invalid front-matter in pages\/a\.md — icon: expected one of .*, got "calender" \(did you mean calendar\?\)$/,
    );
  });
});

describe("brand front-matter", () => {
  it("leaves brandCss empty when the page sets no brand", async () => {
    const page = await compile("# Body\n");

    expect(page.brandCss).toBe("");
    expect(page.code).toContain('export const brandCss = "";');
  });

  it("exports a stylesheet of only the keys the page sets", async () => {
    const page = await compile(
      '---\nbrand:\n  palette:\n    light: ["#1E40AF"]\n---\n# Body\n',
    );

    expect(page.brandCss).toBe(":root,\n.light {\n  --chart-1: #1e40af;\n}\n");
  });

  it("rejects a page colour under its floor on the project brand, naming the page file", async () => {
    const projectBrand = {
      colors: { primary: { light: "#154886", dark: "#60a5fa" } },
      palette: {},
      scale: {},
      fonts: {},
    };
    const markdown =
      '---\nbrand:\n  colors:\n    background: { light: "#3b5c99", dark: "#0a0a0a" }\n---\n# Body\n';

    const compiled = compilePage(markdown, "pages/a.md", {}, projectBrand);

    await expect(compiled).rejects.toThrow(
      "Invalid front-matter in pages/a.md — brand.colors.background.light: #3b5c99 against --primary #154886 measures 1.37:1",
    );
  });
});

describe("module source", () => {
  it("exports frontmatter, title and sqlBlocks alongside the default component", async () => {
    const page = await compile(
      "---\ntitle: Report\n---\n# Body\n\n```sql orders\nselect 1\n```\n",
    );

    expect(page.code).toContain("export default");
    expect(page.code).toContain(
      'export const frontmatter = {"title":"Report"};',
    );
    expect(page.code).toContain('export const title = "Report";');
    expect(page.code).toContain(
      'export const sqlBlocks = [{"name":"orders","sql":"select 1"}];',
    );
  });

  it("exports sqlTables alongside sqlBlocks", async () => {
    const page = await compile(
      "---\nsql:\n  orders: data/orders.csv\n---\n# Body\n\n```sql orders\nselect 1\n```\n",
    );

    expect(page.code).toContain(
      'export const sqlTables = {"orders":"data/orders.csv"};',
    );
  });

  it("produces a module that imports and exposes the same metadata", async () => {
    const page = await compile(
      "---\ntitle: Report\n---\n# Body\n\n```sql orders\nselect 1\n```\n",
    );

    const mod = await importCompiledModule(page.code);

    expect(typeof mod.default).toBe("function");
    expect(mod.frontmatter).toEqual(page.frontmatter);
    expect(mod.title).toBe(page.title);
    expect(mod.sqlBlocks).toEqual(page.sqlBlocks);
    expect(mod.sqlTables).toEqual(page.sqlTables);
    expect(mod.layout).toEqual(page.layout);
    expect(mod.brandCss).toBe(page.brandCss);
  });

  it("exports layout alongside sqlTables", async () => {
    const page = await compile("---\npage_width: full\n---\n# Body\n");

    expect(page.code).toContain('export const layout = {"page_width":"full"};');
  });
});

describe("markdown constructs", () => {
  it("compiles gfm tables", async () => {
    const page = await compile("| a | b |\n| - | - |\n| 1 | 2 |\n");

    expect(page.code).toContain('"table"');
    expect(page.code).toContain('"td"');
  });

  it("compiles gfm strikethrough", async () => {
    const page = await compile("~~gone~~\n");

    expect(page.code).toContain('"del"');
  });

  it("compiles JSX widgets inside .md pages", async () => {
    const page = await compile('<BigValue data="orders"/>\n');

    expect(page.code).toContain("BigValue");
  });

  it("reports a body error at its line in the file, front-matter included", async () => {
    const markdown = "---\ntitle: T\n---\n\n# Hi\n\n<Callout\n";

    const failure = await compile(markdown).catch((error: unknown) => error);

    expect(failure).toMatchObject({ line: 8, column: 1 });
  });

  it("rejects a filter id reserved for the source editor at its line in the file", async () => {
    const markdown = '---\ntitle: T\n---\n\n<TextInput id="edit" />\n';

    const failure = await compile(markdown).catch((error: unknown) => error);

    expect(failure).toMatchObject({
      message: expect.stringContaining('Reserved filter id "edit"'),
      line: 5,
      column: 12,
    });
  });

  it("rejects an unknown search method at its line in the file", async () => {
    const markdown =
      '---\ntitle: T\n---\n\n<Search id="q" column="region" method="regexp" />\n';

    const failure = await compile(markdown).catch((error: unknown) => error);

    expect(failure).toMatchObject({
      message: expect.stringContaining('Unknown method "regexp"'),
      line: 5,
      column: 32,
    });
  });

  it("rejects malformed mdx expressions", async () => {
    await expect(compile("broken {unclosed\n")).rejects.toThrow();
  });
});
