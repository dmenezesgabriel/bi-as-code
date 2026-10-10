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
