import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import { remarkRejectUnknownSearchMethod } from "./search-method.js";

const compileBody = (markdown: string) =>
  compile(markdown, {
    format: "mdx",
    remarkPlugins: [remarkRejectUnknownSearchMethod],
  });

const failureOf = (markdown: string) =>
  compileBody(markdown).catch((error: unknown) => error);

describe("a <Search method>", () => {
  it.each(["contains", "prefix", "suffix"])("accepts %s", async (method) => {
    const markdown = `<Search id="q" column="region" method="${method}" />\n`;

    await expect(compileBody(markdown)).resolves.toBeDefined();
  });

  it("names the value, the accepted methods and the closest one", async () => {
    const markdown = '<Search id="q" column="region" method="prefx" />\n';

    await expect(compileBody(markdown)).rejects.toThrow(
      'Unknown method "prefx" on <Search method> — expected one of contains, prefix, suffix (did you mean prefix?)',
    );
  });

  it("rejects regexp, which mosaic offers and we do not", async () => {
    const markdown = '<Search id="q" column="region" method="regexp" />\n';

    await expect(compileBody(markdown)).rejects.toThrow(
      'Unknown method "regexp" on <Search method>',
    );
  });

  it("reads a string literal expression", async () => {
    const markdown = '<Search id="q" column="region" method={"exact"} />\n';

    await expect(compileBody(markdown)).rejects.toThrow(
      'Unknown method "exact" on <Search method>',
    );
  });

  it("points at the attribute's line and column", async () => {
    const markdown =
      '# Title\n\n<Search id="q" column="region" method="x" />\n';

    const failure = await failureOf(markdown);

    expect(failure).toMatchObject({ line: 3, column: 32 });
  });
});

describe("what the check leaves alone", () => {
  it.each([
    ["a Search with no method", '<Search id="q" column="region" />\n'],
    [
      "a method the compiler cannot read",
      '<Search id="q" column="region" method={chosen} />\n',
    ],
    ["another tag's method prop", '<Callout method="anything" />\n'],
  ])("passes %s", async (_label, markdown) => {
    await expect(compileBody(markdown)).resolves.toBeDefined();
  });
});
