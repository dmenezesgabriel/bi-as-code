import type { NavTree } from "virtual:biac-pages";

/** A two-level nav tree: two root pages and one directory holding one page. */
export const GUIDES_NAV_TREE: NavTree = {
  rootPages: [
    { name: "Home", href: "/" },
    { name: "Weekly review", href: "/weekly-review" },
  ],
  directories: [
    {
      id: "guides",
      name: "Guides",
      pages: [{ name: "Getting started", href: "/guides/getting-started" }],
    },
  ],
};
