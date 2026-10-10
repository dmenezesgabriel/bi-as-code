import { screen } from "@testing-library/react";
import { EditorView, runScopeHandlers } from "@codemirror/view";

/** The live CodeMirror view behind the editable region named `label`. */
export function mountedView(label: string): EditorView {
  const view = EditorView.findFromDOM(
    screen.getByRole("textbox", { name: label }),
  );
  if (!view) throw new Error(`no EditorView behind textbox "${label}"`);
  return view;
}

/** Fires `Mod-s` through the view's keymaps, as a real keypress would. */
export function pressModS(view: EditorView): void {
  const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true });
  runScopeHandlers(view, event, "editor");
}
