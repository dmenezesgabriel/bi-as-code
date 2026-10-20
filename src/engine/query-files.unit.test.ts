import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import { remarkQueryFiles } from "./query-files.js";
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
});
