import { describe, expect, it } from "vitest";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { pageSourceLanguage } from "./page-source-language";

/**
 * The innermost node starting at `text`'s first character. `resolveInner`
 * enters the overlay trees nested-language parsers mount on a fence, which
 * a plain `iterate` over the outer tree skips.
 */
function innermostNodeAt(doc: string, text: string): string {
  const state = EditorState.create({ doc, extensions: [pageSourceLanguage()] });
  const tree = ensureSyntaxTree(state, doc.length, 5000);
  if (!tree) throw new Error(`no syntax tree for doc ${JSON.stringify(doc)}`);
  return tree.resolveInner(doc.indexOf(text), 1).name;
}

describe("pageSourceLanguage", () => {
  it("parses a named sql fence's body as SQL", () => {
    // Arrange
    const doc = "# Orders\n\n```sql orders\nselect region from orders\n```\n";

    // Act
    const name = innermostNodeAt(doc, "select");

    // Assert
    expect(name).toBe("Keyword");
  });

  it("leaves a non-sql fence's body as plain code text", () => {
    // Arrange
    const doc = "```js\nselect region from orders\n```\n";

    // Act
    const name = innermostNodeAt(doc, "select");

    // Assert
    expect(name).toBe("CodeText");
  });
});
