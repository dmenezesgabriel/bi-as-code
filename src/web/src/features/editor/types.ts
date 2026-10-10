/** Props of `CodeEditor`, the page-source editor surface. */
export type CodeEditorProps = {
  /** The initial document. Later changes to this prop are ignored: the
   * editor owns its buffer so cursor, selection and scroll survive the
   * parent's re-renders. */
  doc: string;
  /** Accessible name of the editable region. */
  label: string;
  /** Called with the whole document after every edit. */
  onChange?: (doc: string) => void;
  /** Called with the whole document on `Mod-s`. */
  onSave: (doc: string) => void;
};

/**
 * Read/write access to one page's source on the dev server. `file` is the
 * manifest's project-relative path, e.g. "pages/weekly-review.md". Both
 * methods reject with an error naming the file and the HTTP status.
 */
export interface PageSourcePort {
  read(file: string): Promise<string>;
  save(file: string, source: string): Promise<void>;
}

/**
 * Where the page editor's buffer stands against the file on disk.
 * `saving.editedDuringSave` remembers keystrokes typed while a `PUT` was in
 * flight, so a finished save never claims `saved` over unsaved text.
 */
export type EditorStatus =
  | { readonly kind: "loading" }
  | { readonly kind: "loadFailed"; readonly message: string }
  | { readonly kind: "clean" }
  | { readonly kind: "dirty" }
  | { readonly kind: "saving"; readonly editedDuringSave: boolean }
  | { readonly kind: "saved" }
  | { readonly kind: "saveFailed"; readonly message: string };

/** What happened to the buffer or its round-trip to the dev server. */
export type EditorStatusEvent =
  | { readonly type: "loaded" }
  | { readonly type: "loadFailed"; readonly message: string }
  | { readonly type: "edited" }
  | { readonly type: "saveStarted" }
  | { readonly type: "saveSucceeded" }
  | { readonly type: "saveFailed"; readonly message: string };
