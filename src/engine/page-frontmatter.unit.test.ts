import { VFile } from "vfile";
import { describe, expect, it } from "vitest";
import { parseFrontmatterBlock } from "./page-frontmatter.js";

function parseFailure(markdown: string): unknown {
  try {
    parseFrontmatterBlock(new VFile({ path: "pages/a.md", value: markdown }));
  } catch (error) {
    return error;
  }
  throw new Error(`expected front-matter to fail to parse, got ${markdown}`);
}

describe("parseFrontmatterBlock", () => {
  it("puts a yaml syntax error at its line and column in the file", () => {
    const failure = parseFailure("---\ntitle: Weekly review: x\n---\n");

    expect(failure).toMatchObject({ line: 2, column: 8 });
  });

  it("counts lines in the file when the file uses CRLF line breaks", () => {
    const failure = parseFailure(
      "---\r\ntitle: a\r\nx: Weekly review: x\r\n---\r\n",
    );

    expect(failure).toMatchObject({ line: 3, column: 4 });
  });

  it("drops the yaml block's own line count and keeps the offending line", () => {
    const failure = parseFailure("---\ntitle: Weekly review: x\n---\n");

    expect((failure as Error).message).not.toMatch(/ at line /);
    expect((failure as Error).message).toMatch(
      /^Nested mappings are not allowed in compact mappings:\n\ntitle: Weekly review: x\n {7}\^/,
    );
  });

  it("parses valid yaml into the file's data", () => {
    const file = new VFile({ value: "---\ntitle: T\n---\n# Hi\n" });

    parseFrontmatterBlock(file, { strip: true });

    expect(file.data.matter).toEqual({ title: "T" });
    expect(String(file.value)).toBe("# Hi\n");
  });
});
