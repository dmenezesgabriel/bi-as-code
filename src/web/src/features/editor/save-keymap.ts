import { keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

/**
 * Binds `Mod-s` (Ctrl-s, Cmd-s on a Mac) to `onSave` with the current
 * document. `preventDefault` keeps the browser's "Save page as" dialog from
 * opening even when a handler declines the key.
 *
 * @example
 * new EditorView({ extensions: [saveKeymap((doc) => putPageSource(doc))] });
 */
export function saveKeymap(onSave: (doc: string) => void): Extension {
  return keymap.of([
    {
      key: "Mod-s",
      preventDefault: true,
      run: (view) => {
        onSave(view.state.doc.toString());
        return true;
      },
    },
  ]);
}
