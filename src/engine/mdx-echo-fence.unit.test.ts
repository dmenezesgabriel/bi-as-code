import { compile } from "@mdx-js/mdx";
import type { Code, Root } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { remarkSpliceMdxEcho } from "./mdx-echo-fence.js";

/** The page's top-level mdast nodes once the splice has run. */
async function splicedChildren(markdown: string): Promise<Root["children"]> {
  let spliced: Root | undefined;
  const captureTree = () => (tree: Root) => {
    spliced = structuredClone(tree);
  };
  await compile(markdown, {
    format: "mdx",
    remarkPlugins: [remarkGfm, remarkSpliceMdxEcho, captureTree],
  });
  if (!spliced) throw new Error("captureTree never ran");
  return spliced.children;
}

describe("an mdx echo fence", () => {
  it("renders its markup ahead of the code that shows it", async () => {
    const markdown = '```mdx echo\n<Table data="orders" />\n```\n';

    const children = await splicedChildren(markdown);

    expect(children.map((node) => node.type)).toEqual([
      "mdxJsxFlowElement",
      "code",
    ]);
    expect(children[1]).toMatchObject({
      lang: "mdx",
      value: '<Table data="orders" />',
    });
  });

  it("drops the echo flag from the code it keeps", async () => {
    const children = await splicedChildren("```mdx echo\n<Table />\n```\n");

    expect((children[1] as Code).meta).toBeNull();
  });

  it("parses its markup with the page's own syntax, gfm tables included", async () => {
    const markdown = "```mdx echo\n| a |\n| - |\n| 1 |\n```\n";

    const children = await splicedChildren(markdown);

    expect(children[0]?.type).toBe("table");
  });
});

describe("fences the splice leaves alone", () => {
  it("keeps a plain mdx fence code-only", async () => {
    const children = await splicedChildren("```mdx\n<Table />\n```\n");

    expect(children.map((node) => node.type)).toEqual(["code"]);
  });

  it("keeps another language's echo fence code-only", async () => {
    const children = await splicedChildren("```js echo\nlet a = 1;\n```\n");

    expect(children.map((node) => node.type)).toEqual(["code"]);
  });
});

describe("a snippet's place in its page file", () => {
  it("is where its spliced markup says it starts", async () => {
    const markdown = '# T\n\n```mdx echo\n<Table data="orders" />\n```\n';

    const children = await splicedChildren(markdown);

    expect(children[1]?.position?.start).toMatchObject({ line: 4, column: 1 });
  });

  it("is where its spliced markup's attributes say they start", async () => {
    const markdown = '# T\n\n```mdx echo\n<Table data="orders" />\n```\n';

    const children = await splicedChildren(markdown);

    const table = children[1] as MdxJsxFlowElement;
    expect(table.attributes[0]?.position?.start).toMatchObject({
      line: 4,
      column: 8,
    });
  });

  it("names a syntax error by its page line and column", async () => {
    const markdown = "# T\n\n```mdx echo\n<Table />\n<Chart x= />\n```\n";

    const failure = await splicedChildren(markdown).catch(
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({
      line: 5,
      column: 11,
      source: "micromark-extension-mdx-jsx",
    });
  });

  it("counts a list item's indent into a syntax error's column", async () => {
    const markdown = "- item\n\n  ```mdx echo\n  <Chart x= />\n  ```\n";

    const failure = await splicedChildren(markdown).catch(
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({ line: 4, column: 13 });
  });
});

describe("an unknown mdx fence attribute", () => {
  it("is rejected at its fence's line, naming the accepted one", async () => {
    const markdown = "# T\n\n```mdx show\n<Table />\n```\n";

    const failure = await splicedChildren(markdown).catch(
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({
      message: 'Unknown mdx fence attribute "show" — expected `mdx echo`',
      line: 3,
    });
  });
});
