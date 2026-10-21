// Types the site-search module served by the engine's vite plugin —
// `virtual:` ids have no real file for tsc to resolve, so the contract is
// declared here. The sidebar's search box imports it on first focus; in
// dev the module hot-updates itself when a page or `translations.yaml`
// changes and tells its subscribers.
declare module "virtual:biac-search" {
  import type { PageSearchDocument } from "./features/search/types";
  /** The pages not marked `index: false`, in route order, with `language`'s text — the first declared language's when it is undefined or not declared. */
  export function searchDocumentsFor(
    language: string | undefined,
  ): readonly PageSearchDocument[];
  /** Calls `listener` whenever the documents change; returns the unsubscribe. */
  export function subscribeSearchDocuments(listener: () => void): () => void;
}
