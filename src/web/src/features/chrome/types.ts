/**
 * The languages `translations.yaml` declares, as a store the shell reads
 * with `useSyncExternalStore`: `get` returns the same array until the list
 * changes, and `biac dev` notifies `subscribe`rs when a saved file does.
 */
export interface DeclaredLanguages {
  get(): readonly string[];
  subscribe(onChange: () => void): () => void;
}

/** What a framed page posts to its parent each time its content height changes. */
export interface FrameHeightMessage {
  type: "biac:height";
  /** The content's height in CSS pixels — the iframe height that shows it without a scrollbar. */
  height: number;
}

/** A window a frame height can be posted to. */
export interface FrameParent {
  postMessage(message: FrameHeightMessage, targetOrigin: string): void;
}

/**
 * The part of the page's own `window` the height reporter reads: its
 * parent, and the two places a browser names the parent's origin. Injected
 * so tests and stories can stand in a parent that is not a real window.
 */
export interface FrameWindow extends FrameParent {
  parent: FrameParent;
  location: { ancestorOrigins?: ArrayLike<string> };
  document: { referrer: string };
}
