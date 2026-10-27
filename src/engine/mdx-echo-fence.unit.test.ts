import { compile } from "@mdx-js/mdx";
import type { Code, Root } from "mdast";
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
