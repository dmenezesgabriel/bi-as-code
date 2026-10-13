import { describe, expect, it } from "vitest";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { typeKeyByKey } from "./editor-test-view";
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

/** The document after typing `text` key by key into an empty editor. */
function typedIntoEmptyEditor(text: string): string {
  const view = new EditorView({ extensions: [pageSourceLanguage()] });
  typeKeyByKey(view, text);
  const typed = view.state.doc.toString();
  view.destroy();
  return typed;
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

describe("pageSourceLanguage tag auto-close", () => {
  it.each([
    '<Table data="orders" />',
    "<Details />",
    '<BarChart data="orders" x="region" y="revenue" />',
  ])("leaves the self-closed widget %s as typed", (tag) => {
    // Arrange, Act
    const typed = typedIntoEmptyEditor(tag);

    // Assert
    expect(typed).toBe(tag);
  });

  it("closes a widget that takes children", () => {
    // Arrange, Act
    const typed = typedIntoEmptyEditor('<Details title="x">');

    // Assert
    expect(typed).toBe('<Details title="x"></Details>');
  });
});
