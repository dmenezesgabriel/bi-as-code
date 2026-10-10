import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { saveKeymap } from "./save-keymap";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
});

function mountWithSaveKeymap(doc: string, onSave: (doc: string) => void) {
  view = new EditorView({ doc, extensions: [saveKeymap(onSave)] });
  return view;
}

/** jsdom's navigator is not a Mac, so CodeMirror reads `Mod` as Ctrl. */
function keydown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", { cancelable: true, ...init });
}

describe("saveKeymap", () => {
  it("hands the whole document to onSave on Mod-s and claims the key", () => {
    // Arrange
    const onSave = vi.fn();
    const editor = mountWithSaveKeymap("# Weekly review\n", onSave);

    // Act
    const handled = runScopeHandlers(
      editor,
      keydown({ key: "s", ctrlKey: true }),
      "editor",
    );

    // Assert
    expect(handled).toBe(true);
    expect(onSave).toHaveBeenCalledExactlyOnceWith("# Weekly review\n");
  });

  it("leaves a plain s keystroke to the editor", () => {
    // Arrange
    const onSave = vi.fn();
    const editor = mountWithSaveKeymap("", onSave);

    // Act
    const handled = runScopeHandlers(editor, keydown({ key: "s" }), "editor");

    // Assert
    expect(handled).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });
});
