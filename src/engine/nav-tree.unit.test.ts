import { describe, expect, it } from "vitest";
import { buildNavTree } from "./nav-tree.js";
import type { PageManifestEntry } from "./types.js";

interface NavFields {
  title?: string;
  sidebarPosition?: number;
  icon?: string;
}

/**
 * Test fixture mirroring `discoverPages`' route mapping: `pages/index.md` →
 * `/`, `pages/nested/index.md` → `/nested`, anything else → its path. The
 * function under test only reads the fields this builds.
 */
function page(file: string, nav: NavFields = {}): PageManifestEntry {
  const stem = file.slice("pages/".length).replace(/\.(md|mdx)$/, "");
  const segments = stem.split("/");
  const isIndex = segments.at(-1) === "index";
  const route = isIndex ? `/${segments.slice(0, -1).join("/")}` : `/${stem}`;
  return { route, file, isIndex, ...nav };
}

describe("root pages", () => {
  it("puts the home page first and names an untitled one Home", () => {
    const tree = buildNavTree(
      [page("pages/b.md"), page("pages/index.md"), page("pages/a.md")],
      {},
    );

    expect(tree.rootPages).toEqual([
      { name: "Home", href: "/" },
      { name: "A", href: "/a" },
      { name: "B", href: "/b" },
    ]);
  });

  it("prefers the front-matter title over the deslugified file name", () => {
    const tree = buildNavTree(
      [
        page("pages/index.md", { title: "Welcome" }),
        page("pages/getting-started.md"),
      ],
      {},
    );

    expect(tree.rootPages).toEqual([
      { name: "Welcome", href: "/" },
      { name: "Getting Started", href: "/getting-started" },
    ]);
  });
});

describe("icons", () => {
  it("carries a page's icon into its nav link, root and directory alike", () => {
    const tree = buildNavTree(
      [
        page("pages/index.md", { icon: "house" }),
        page("pages/nested/page.md", { icon: "map-pin" }),
      ],
      {},
    );

    expect(tree.rootPages).toEqual([
      { name: "Home", href: "/", icon: "house" },
    ]);
    expect(tree.directories[0]!.pages).toEqual([
      { name: "Page", href: "/nested/page", icon: "map-pin" },
    ]);
  });

  it("leaves icon off a link whose page names none", () => {
    const tree = buildNavTree([page("pages/index.md")], {});

    expect(tree.rootPages[0]).not.toHaveProperty("icon");
  });
});

describe("ordering", () => {
  it("orders positioned pages ascending by sidebarPosition", () => {
    const tree = buildNavTree(
      [
        page("pages/index.md"),
        page("pages/c.md", { sidebarPosition: 3 }),
        page("pages/a.md", { sidebarPosition: 1 }),
        page("pages/b.md", { sidebarPosition: 2 }),
      ],
      {},
    );

    expect(tree.rootPages.map((p) => p.href)).toEqual(["/", "/a", "/b", "/c"]);
  });

  it("breaks position ties by display name", () => {
    const tree = buildNavTree(
      [
        page("pages/beta.md", { sidebarPosition: 1 }),
        page("pages/alpha.md", { sidebarPosition: 1 }),
      ],
      {},
    );

    expect(tree.rootPages.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
  });

  it("sorts positioned pages before unpositioned ones", () => {
    const tree = buildNavTree(
      [
        page("pages/zebra.md"),
        page("pages/walrus.md", { sidebarPosition: 9 }),
        page("pages/apple.md"),
      ],
      {},
    );

    expect(tree.rootPages.map((p) => p.href)).toEqual([
      "/walrus",
      "/apple",
      "/zebra",
    ]);
  });

  it("ties on the display name, so a title beats the slug", () => {
    const tree = buildNavTree(
      [page("pages/zebra.md", { title: "Apple" }), page("pages/banana.md")],
      {},
    );

    expect(tree.rootPages.map((p) => p.name)).toEqual(["Apple", "Banana"]);
  });

  it("keeps the home page first even when another page has a position", () => {
    const tree = buildNavTree(
      [page("pages/index.md"), page("pages/a.md", { sidebarPosition: 1 })],
      {},
    );

    expect(tree.rootPages[0]).toEqual({ name: "Home", href: "/" });
  });
});

describe("directories", () => {
  it("groups deeper pages under their first slug segment, deslugified", () => {
    const tree = buildNavTree(
      [
        page("pages/index.md"),
        page("pages/user-guides/b.md"),
        page("pages/user-guides/a.md"),
      ],
      {},
    );

    expect(tree.rootPages).toEqual([{ name: "Home", href: "/" }]);
    expect(tree.directories).toEqual([
      {
        id: "user-guides",
        name: "User Guides",
        pages: [
          { name: "A", href: "/user-guides/a" },
          { name: "B", href: "/user-guides/b" },
        ],
      },
    ]);
  });

  it("puts a directory index page inside its own directory", () => {
    const tree = buildNavTree(
      [
        page("pages/index.md"),
        page("pages/nested/index.md", { title: "Overview" }),
        page("pages/nested/page.md"),
      ],
      {},
    );

    expect(tree.rootPages).toEqual([{ name: "Home", href: "/" }]);
    expect(tree.directories).toEqual([
      {
        id: "nested",
        name: "Nested",
        pages: [
          { name: "Overview", href: "/nested" },
          { name: "Page", href: "/nested/page" },
        ],
      },
    ]);
  });

  it("groups depth > 2 under the first segment", () => {
    const tree = buildNavTree([page("pages/a/b/deep-page.md")], {});

    expect(tree.rootPages).toEqual([]);
    expect(tree.directories).toEqual([
      {
        id: "a",
        name: "A",
        pages: [{ name: "Deep Page", href: "/a/b/deep-page" }],
      },
    ]);
  });

  it("orders directories by their first page's sorted position", () => {
    const tree = buildNavTree(
      [
        page("pages/zebra-dir/y.md", { sidebarPosition: 5 }),
        page("pages/apple-dir/x.md", { sidebarPosition: 1 }),
      ],
      {},
    );

    expect(tree.directories.map((d) => d.id)).toEqual([
      "apple-dir",
      "zebra-dir",
    ]);
  });
});

describe("directory titles", () => {
  it("names a folder by its configured title and keeps its id", () => {
    const tree = buildNavTree([page("pages/nested/page.md")], {
      "pages/nested": { title: "Planning" },
    });

    expect(tree.directories).toEqual([
      {
        id: "nested",
        name: "Planning",
        pages: [{ name: "Page", href: "/nested/page" }],
      },
    ]);
  });

  it("deslugifies a folder the titles leave out", () => {
    const tree = buildNavTree(
      [page("pages/nested/page.md"), page("pages/user-guides/a.md")],
      { "pages/nested": { title: "Planning" } },
    );

    expect(tree.directories.map((d) => d.name)).toEqual([
      "User Guides",
      "Planning",
    ]);
  });
});

it("returns an empty tree for an empty manifest", () => {
  expect(buildNavTree([], {})).toEqual({ rootPages: [], directories: [] });
});
