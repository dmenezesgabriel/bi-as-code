// Types the page manifest module served by the engine's vite plugin —
// `virtual:` ids have no real file for tsc to resolve, so the contract is
// declared here. The manifest regenerates on page add/remove/rename.
declare module "virtual:biac-pages" {
  export const pages: import("./features/pages/types").ManifestPageEntry[];
}
