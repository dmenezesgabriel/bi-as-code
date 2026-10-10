import { useEffect, useRef, useState, type ReactElement } from "react";
import { basicSetup } from "codemirror";
import { Compartment, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { useThemeMode } from "../chrome/theme-mode";
import type { ThemeMode } from "../chrome/theme";
import { pageSourceLanguage } from "./page-source-language";
import { saveKeymap } from "./save-keymap";
import type { CodeEditorProps } from "./types";

type EditorCallbacks = Pick<CodeEditorProps, "onChange" | "onSave">;

/** Light keeps `basicSetup`'s default highlight style; dark swaps in One Dark. */
function editorTheme(mode: ThemeMode): Extension {
  return mode === "dark" ? oneDark : [];
}

/**
 * The view's extensions. Callbacks go through `callbacks` so a parent
 * passing new closures never forces a rebuild of the view (and with it the
 * loss of cursor, selection and scroll).
 */
function editorExtensions(
  label: string,
  themeSlot: Compartment,
  mode: ThemeMode,
  callbacks: { readonly current: EditorCallbacks },
): Extension[] {
  return [
    basicSetup,
    pageSourceLanguage(),
    saveKeymap((doc) => callbacks.current.onSave(doc)),
    EditorView.updateListener.of((update) => {
      if (update.docChanged)
        callbacks.current.onChange?.(update.state.doc.toString());
    }),
    EditorView.contentAttributes.of({ "aria-label": label }),
    themeSlot.of(editorTheme(mode)),
  ];
}

/**
 * A CodeMirror editor for a page's markdown source: SQL highlighting inside
 * ```` ```sql ```` fences, the app's light/dark mode, `Mod-s` to save. The
 * editor owns its buffer — `doc` seeds it once.
 *
 * @example
 * <CodeEditor doc={source} label="Page source" onChange={markDirty} onSave={save} />
 */
export function CodeEditor({
  doc,
  label,
  onChange,
  onSave,
}: CodeEditorProps): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const mode = useThemeMode();
  // Mount-time inputs: the view is built once and must not rebuild when
  // the parent re-renders with a new `doc`, `label` or `mode`.
  const [initial] = useState(() => ({ doc, label, mode }));
  const [themeSlot] = useState(() => new Compartment());
  // Synced in an effect, not during render: React can replay or discard
  // uncommitted render work.
  const callbacks = useRef<EditorCallbacks>({ onChange, onSave });
  useEffect(() => {
    callbacks.current = { onChange, onSave };
  });

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current ?? undefined,
      doc: initial.doc,
      extensions: editorExtensions(
        initial.label,
        themeSlot,
        initial.mode,
        callbacks,
      ),
    });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [initial, themeSlot]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeSlot.reconfigure(editorTheme(mode)),
    });
  }, [mode, themeSlot]);

  return <div ref={hostRef} className="h-full min-h-0 [&_.cm-editor]:h-full" />;
}
