import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { compilePage } from "./compile-page.js";

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

  it("rejects malformed mdx expressions", async () => {
    await expect(compile("broken {unclosed\n")).rejects.toThrow();
  });
});
