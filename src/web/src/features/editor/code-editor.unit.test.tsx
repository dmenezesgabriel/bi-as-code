import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { ThemeModeProvider } from "../chrome/theme-mode";
import type { ThemeMode } from "../chrome/theme";
import { CodeEditor } from "./code-editor";
import type { CodeEditorProps } from "./types";

const LABEL = "Page source";

function editorUnder(mode: ThemeMode, props: Partial<CodeEditorProps> = {}) {
  return (
    <ThemeModeProvider mode={mode}>
      <CodeEditor
        doc={"# Orders\n"}
        label={LABEL}
        onSave={vi.fn()}
        {...props}
      />
    </ThemeModeProvider>
  );
}

/** The live view behind the rendered editable region. */
function mountedView(): EditorView {
  const view = EditorView.findFromDOM(screen.getByRole("textbox"));
  if (!view) throw new Error(`no EditorView behind textbox "${LABEL}"`);
  return view;
}

function pressModS(view: EditorView): void {
  const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true });
  runScopeHandlers(view, event, "editor");
}

describe("CodeEditor", () => {
  it("shows the initial document in a labelled editable region", () => {
    // Arrange / Act
    render(editorUnder("light"));

    // Assert
    const textbox = screen.getByRole("textbox", { name: LABEL });
    expect(textbox).toHaveTextContent("# Orders");
    expect(mountedView().state.doc.toString()).toBe("# Orders\n");
  });

  it("reports every edit through onChange with the whole document", () => {
    // Arrange
    const onChange = vi.fn();
    render(editorUnder("light", { onChange }));

    // Act
    mountedView().dispatch({ changes: { from: 0, insert: "x" } });

    // Assert
    expect(onChange).toHaveBeenCalledExactlyOnceWith("x# Orders\n");
  });

  it("calls the latest callbacks after a re-render without rebuilding the view", () => {
    // Arrange
    const firstSave = vi.fn();
    const latestSave = vi.fn();
    const { rerender } = render(editorUnder("light", { onSave: firstSave }));
    const viewBefore = mountedView();

    // Act
    rerender(editorUnder("light", { onSave: latestSave, doc: "ignored" }));
    pressModS(mountedView());

    // Assert
    expect(mountedView()).toBe(viewBefore);
    expect(firstSave).not.toHaveBeenCalled();
    expect(latestSave).toHaveBeenCalledExactlyOnceWith("# Orders\n");
  });

  it("follows the theme mode without losing the buffer", () => {
    // Arrange
    const { rerender } = render(editorUnder("light"));
    const viewBefore = mountedView();
    viewBefore.dispatch({ changes: { from: 0, insert: "edited " } });

    // Act
    rerender(editorUnder("dark"));

    // Assert
    const view = mountedView();
    expect(view).toBe(viewBefore);
    expect(view.state.facet(EditorView.darkTheme)).toBe(true);
    expect(view.state.doc.toString()).toBe("edited # Orders\n");
  });

  it("starts light when the mode is light", () => {
    // Arrange / Act
    render(editorUnder("light"));

    // Assert
    expect(mountedView().state.facet(EditorView.darkTheme)).toBe(false);
  });
});
