// Types the page manifest module served by the engine's vite plugin —
// `virtual:` ids have no real file for tsc to resolve, so the contract is
// declared here. The manifest regenerates on page add/remove/rename and on
// front-matter edits (`title`/`sidebar_position` feed `navTree`).
declare module "virtual:biac-pages" {
  export const pages: import("./features/pages/types").ManifestPageEntry[];

  /** One page link inside the sidebar nav tree. */
  export interface NavPage {
    /** Display label: front-matter title, "Home", or the deslugified file name. */
    name: string;
    /** Route the link navigates to. */
    href: string;
  }

  /** A collapsible sidebar group holding every page under one first path segment. */
  export interface NavDirectory {
    /** The first path segment, e.g. "nested" for pages/nested/*. */
    id: string;
    /** Deslugified segment, e.g. "Nested" / "User Guides". */
    name: string;
    pages: NavPage[];
  }

  /** Two-level sidebar tree: root pages plus one directory per first path segment. */
  export interface NavTree {
    rootPages: NavPage[];
    directories: NavDirectory[];
  }

  export const navTree: NavTree;
}
