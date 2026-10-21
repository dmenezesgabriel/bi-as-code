/** One page as the engine's `virtual:biac-search` module serves it. */
export interface PageSearchDocument {
  /** The page's route — what a result links to. */
  readonly id: string;
  /** The label the page's sidebar link shows. */
  readonly title: string;
  /** The page's prose, without code fences or widgets. */
  readonly text: string;
  /** Front-matter `keywords`, comma-joined; "" when absent. */
  readonly keywords: string;
}

/** One ranked match: the page to link to and its label. */
export interface PageSearchResult {
  readonly id: string;
  readonly title: string;
}

/** A built index, queried as the reader types. */
export interface PageIndex {
  search(query: string): PageSearchResult[];
}

/**
 * The search documents in every language the project declares, as
 * `virtual:biac-search` serves them; in dev a saved page updates them.
 */
export interface PageSearchSource {
  /** The documents in `language` — the first declared language's when it is undefined or not declared. The same array until an update. */
  documentsFor(language: string | undefined): readonly PageSearchDocument[];
  /** Calls `listener` whenever the documents change; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** Fetches the search documents — the composition root lazy-imports them. */
export type LoadPageSearchDocuments = () => Promise<PageSearchSource>;

/** Where the index stands: not asked for, on its way, built, or failed. */
export type PageIndexState =
  | { readonly status: "idle" | "loading" }
  | { readonly status: "ready"; readonly index: PageIndex }
  | { readonly status: "failed" };
