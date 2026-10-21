/**
 * The languages `translations.yaml` declares, as a store the shell reads
 * with `useSyncExternalStore`: `get` returns the same array until the list
 * changes, and `biac dev` notifies `subscribe`rs when a saved file does.
 */
export interface DeclaredLanguages {
  get(): readonly string[];
  subscribe(onChange: () => void): () => void;
}
