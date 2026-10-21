import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import { remarkRejectReservedFilterIds } from "./reserved-filter-id.js";

const compileBody = (markdown: string) =>
  compile(markdown, {
    format: "mdx",
    remarkPlugins: [remarkRejectReservedFilterIds],
  });

const failureOf = (markdown: string) =>
  compileBody(markdown).catch((error: unknown) => error);

describe("an input's id", () => {
  it.each([
    "Dropdown",
    "MultiSelect",
    "Slider",
    "ButtonGroup",
    "TextInput",
    "Search",
    "Toggle",
    "DateRange",
  ])("rejects <%s id> naming the editor's key", async (tag) => {
    const markdown = `<${tag} id="edit" />\n`;

    await expect(compileBody(markdown)).rejects.toThrow(
      `Reserved filter id "edit" on <${tag} id>`,
    );
  });

  it("says what owns the key and what to do about it", async () => {
    const markdown = '<TextInput id="edit" />\n';

    await expect(compileBody(markdown)).rejects.toThrow(
      'Reserved filter id "edit" on <TextInput id> — "edit" opens the source editor in biac dev; choose another id',
    );
  });

  it("says the language key chooses the page language", async () => {
    const markdown = '<Dropdown id="lang" />\n';

    await expect(compileBody(markdown)).rejects.toThrow(
      'Reserved filter id "lang" on <Dropdown id> — "lang" chooses the page language; choose another id',
    );
  });

  it("points at the attribute's line and column", async () => {
    const markdown = '# Title\n\n<TextInput id="edit" title="Edit" />\n';

    const failure = await failureOf(markdown);

    expect(failure).toMatchObject({ line: 3, column: 12 });
  });

  it("rejects an input written inline in a paragraph", async () => {
    const markdown = 'Show <Toggle id="edit" /> here\n';

    const failure = await failureOf(markdown);

    expect(failure).toMatchObject({ line: 1, column: 14 });
  });

  it.each([
    ["another id", '<TextInput id="region" />\n'],
    ["a different case", '<TextInput id="Edit" />\n'],
    ["an id that only starts with the key", '<TextInput id="edited" />\n'],
    [
      "an id that only starts with the language key",
      '<TextInput id="language" />\n',
    ],
    ["an id the compiler cannot read", "<TextInput id={chosenId} />\n"],
    ["an id spread in from an object", "<TextInput {...inputProps} />\n"],
    ["an id on a tag that is not an input", '<Column id="edit" />\n'],
  ])("accepts %s", async (_case, markdown) => {
    await expect(compileBody(markdown)).resolves.toBeDefined();
  });
});

describe("a widget's filters", () => {
  it.each([
    ["a string", '<Table data="orders" filters="edit" />\n'],
    ["a string expression", '<Table data="orders" filters={"edit"} />\n'],
    ["a list", '<Table data="orders" filters={["region", "edit"]} />\n'],
  ])("rejects the editor's key written as %s", async (_case, markdown) => {
    await expect(compileBody(markdown)).rejects.toThrow(
      'Reserved filter id "edit" on <Table filters>',
    );
  });

  it("rejects the language key in a list", async () => {
    const markdown = '<Table data="orders" filters={["region", "lang"]} />\n';

    await expect(compileBody(markdown)).rejects.toThrow(
      'Reserved filter id "lang" on <Table filters>',
    );
  });

  it("rejects the key in an input's own filters list", async () => {
    const markdown = '<Dropdown id="region" filters={["edit"]} />\n';

    await expect(compileBody(markdown)).rejects.toThrow(
      'Reserved filter id "edit" on <Dropdown filters>',
    );
  });

  it("points at the filters attribute", async () => {
    const markdown = '<Table data="orders" filters={["region", "edit"]} />\n';

    const failure = await failureOf(markdown);

    expect(failure).toMatchObject({ line: 1, column: 22 });
  });

  it.each([
    ["other ids", '<Table data="orders" filters={["region", "amount"]} />\n'],
    ["a list the compiler cannot read", "<Table filters={[chosenId]} />\n"],
    ["a template literal", "<Table filters={`edit`} />\n"],
    ["a charted column named like the key", '<BarChart x="edit" y="n" />\n'],
  ])("accepts %s", async (_case, markdown) => {
    await expect(compileBody(markdown)).resolves.toBeDefined();
  });
});
