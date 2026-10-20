import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import { queryFilesRead, remarkQueryFiles } from "./query-files.js";
import type { QueryFiles, SqlBlock } from "./types.js";

/** Query files held in memory, keyed by their path under `queries/`. */
class FakeQueryFiles implements QueryFiles {
  readonly reads: string[] = [];

  constructor(private readonly files: Record<string, string>) {}

  async read(name: string): Promise<string | undefined> {
    this.reads.push(name);
    return this.files[name];
  }

  async list(): Promise<string[]> {
    return Object.keys(this.files);
  }
}

async function resolveBlocks(
  markdown: string,
  queryFiles: QueryFiles,
): Promise<SqlBlock[]> {
  const sqlBlocks: SqlBlock[] = [];
  await compile(markdown, {
    format: "mdx",
    remarkPlugins: [[remarkQueryFiles, queryFiles, sqlBlocks]],
  });
  return sqlBlocks;
}

describe("a widget's data naming a query file", () => {
  it("adds the file's SQL as a block named by the reference", async () => {
    const files = new FakeQueryFiles({ "region_orders.sql": "select 1" });

    const blocks = await resolveBlocks(
      '<BarChart data="/queries/region_orders" />\n',
      files,
    );

    expect(blocks).toEqual([
      { name: "/queries/region_orders", sql: "select 1" },
    ]);
  });

  it("reads a file in a subdirectory of queries/", async () => {
    const files = new FakeQueryFiles({ "sales/totals.sql": "select 2" });

    const blocks = await resolveBlocks(
      '<Table data={"/queries/sales/totals"} />\n',
      files,
    );

    expect(blocks).toEqual([
      { name: "/queries/sales/totals", sql: "select 2" },
    ]);
  });

  it("reads a file named by several widgets once", async () => {
    const files = new FakeQueryFiles({ "a.sql": "select 1" });

    const blocks = await resolveBlocks(
      '<Table data="/queries/a" />\n\nSee <Value data="/queries/a" column="x" />\n',
      files,
    );

    expect(blocks).toHaveLength(1);
    expect(files.reads).toEqual(["a.sql"]);
  });

  it("leaves a fence name to the page's own blocks", async () => {
    const files = new FakeQueryFiles({});

    const blocks = await resolveBlocks('<Table data="orders" />\n', files);

    expect(blocks).toEqual([]);
    expect(files.reads).toEqual([]);
  });
});

describe("a sql fence building on a query file", () => {
  it("adds the file a named fence's {{/queries/<path>}} reads", async () => {
    const files = new FakeQueryFiles({ "region_orders.sql": "select 1" });

    const blocks = await resolveBlocks(
      "```sql share\nselect * from {{/queries/region_orders}}\n```\n",
      files,
    );

    expect(blocks).toEqual([
      { name: "/queries/region_orders", sql: "select 1" },
    ]);
  });

  it("trims spaces inside the braces, as the interpolator does", async () => {
    const files = new FakeQueryFiles({ "a.sql": "select 1" });

    const blocks = await resolveBlocks(
      "```sql share\nselect * from {{ /queries/a }}\n```\n",
      files,
    );

    expect(blocks).toEqual([{ name: "/queries/a", sql: "select 1" }]);
  });

  it("ignores a token in an unnamed fence, which never runs", async () => {
    const files = new FakeQueryFiles({});

    const blocks = await resolveBlocks(
      "```sql\nselect * from {{/queries/a}}\n```\n",
      files,
    );

    expect(blocks).toEqual([]);
    expect(files.reads).toEqual([]);
  });

  it("reads a file named by a fence and a widget once", async () => {
    const files = new FakeQueryFiles({ "a.sql": "select 1" });

    await resolveBlocks(
      '<Table data="/queries/a" />\n\n```sql share\nselect * from {{/queries/a}}\n```\n',
      files,
    );

    expect(files.reads).toEqual(["a.sql"]);
  });
});

describe("a query file building on another", () => {
  it("adds the file the first one reads", async () => {
    const files = new FakeQueryFiles({
      "a.sql": "select * from {{/queries/b}} where r = {{params.r}}",
      "b.sql": "select 2",
    });

    const blocks = await resolveBlocks('<Table data="/queries/a" />\n', files);

    expect(blocks).toEqual([
      {
        name: "/queries/a",
        sql: "select * from {{/queries/b}} where r = {{params.r}}",
      },
      { name: "/queries/b", sql: "select 2" },
    ]);
  });

  it("reads each file of a cycle once and leaves the cycle to the registry", async () => {
    const files = new FakeQueryFiles({
      "a.sql": "select * from {{/queries/b}}",
      "b.sql": "select * from {{/queries/a}}",
    });

    const blocks = await resolveBlocks('<Table data="/queries/a" />\n', files);

    expect(blocks.map((block) => block.name)).toEqual([
      "/queries/a",
      "/queries/b",
    ]);
    expect(files.reads).toEqual(["a.sql", "b.sql"]);
  });
});

describe("a query file reference that does not resolve", () => {
  it("names the missing file and the closest one, at the attribute", async () => {
    const files = new FakeQueryFiles({ "region_orders.sql": "select 1" });

    const failure = await resolveBlocks(
      '\n<BarChart x="a" data="/queries/region_order" />\n',
      files,
    ).catch((error: unknown) => error);

    expect(failure).toMatchObject({
      message:
        'Query file queries/region_order.sql not found for data="/queries/region_order" (did you mean /queries/region_orders?)',
      line: 2,
      column: 17,
    });
  });

  it("names the expected shape for a root path outside queries/", async () => {
    const files = new FakeQueryFiles({});

    await expect(
      resolveBlocks('<Table data="/orders" />\n', files),
    ).rejects.toThrow(
      'data="/orders" names no query file — expected data="/queries/<path>" for queries/<path>.sql',
    );
  });
  it("names the missing file at the fence that reads it", async () => {
    const files = new FakeQueryFiles({ "region_orders.sql": "select 1" });

    const failure = await resolveBlocks(
      "# T\n\n```sql share\nselect * from {{/queries/region_order}}\n```\n",
      files,
    ).catch((error: unknown) => error);

    expect(failure).toMatchObject({
      message:
        "Query file queries/region_order.sql not found for {{/queries/region_order}} (did you mean /queries/region_orders?)",
      line: 3,
      column: 1,
    });
  });

  it("names the file that reads a missing one, at the page's reference", async () => {
    const files = new FakeQueryFiles({
      "a.sql": "select * from {{/queries/b}}",
    });

    const failure = await resolveBlocks(
      '\n<Table data="/queries/a" />\n',
      files,
    ).catch((error: unknown) => error);

    expect(failure).toMatchObject({
      message:
        "Query file queries/b.sql not found for {{/queries/b}} in queries/a.sql (did you mean /queries/a?)",
      line: 2,
      column: 8,
    });
  });

  it("names the expected shape for a fence token outside queries/", async () => {
    const files = new FakeQueryFiles({});

    await expect(
      resolveBlocks("```sql share\nselect * from {{/orders}}\n```\n", files),
    ).rejects.toThrow(
      "{{/orders}} names no query file — expected {{/queries/<path>}} for queries/<path>.sql",
    );
  });
});

describe("the query files a compiled page read", () => {
  it("maps each file block to its path from the project root", () => {
    const blocks: SqlBlock[] = [
      { name: "/queries/region_orders", sql: "select 1" },
      { name: "/queries/sales/totals", sql: "select 2" },
    ];

    const files = queryFilesRead(blocks);

    expect(files).toEqual([
      "queries/region_orders.sql",
      "queries/sales/totals.sql",
    ]);
  });

  it("leaves out the page's own fences", () => {
    const blocks: SqlBlock[] = [{ name: "orders", sql: "select 1" }];

    const files = queryFilesRead(blocks);

    expect(files).toEqual([]);
  });
});
