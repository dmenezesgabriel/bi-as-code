// Types the site-search module served by the engine's vite plugin —
// `virtual:` ids have no real file for tsc to resolve, so the contract is
// declared here. The sidebar's search box imports it on first focus.
declare module "virtual:biac-search" {
  import type { PageSearchDocument } from "./features/search/types";
  /** One document per page not marked `index: false`, in route order. */
  export const documents: readonly PageSearchDocument[];
}
