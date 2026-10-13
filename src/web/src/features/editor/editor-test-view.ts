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

/**
 * Types `text` into `view` one key at a time, as keypresses do: each key
 * is offered to the view's input handlers (tag auto-close among them)
 * before falling back to a plain insert at the cursor.
 */
export function typeKeyByKey(view: EditorView, text: string): void {
  for (const key of text) typeKey(view, key);
}

function typeKey(view: EditorView, key: string): void {
  const { from, to } = view.state.selection.main;
  const insert = () =>
    view.state.update({
      changes: { from, to, insert: key },
      selection: { anchor: from + key.length },
      userEvent: "input.type",
    });
  const handlers = view.state.facet(EditorView.inputHandler);
  if (handlers.some((handle) => handle(view, from, to, key, insert))) return;
  view.dispatch(insert());
}
