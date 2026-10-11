import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import { discoverPages } from "./discover-pages.js";

let projectRoot: string | undefined;

afterEach(() => {
  cleanupProjects();
  projectRoot = undefined;
});

function makeProject(): string {
  projectRoot = makeTempProject("biac-pages-");
  return projectRoot;
}

function writeFile(projectRoot: string, relativePath: string): void {
  writeProjectFile(projectRoot, relativePath, "# Page\n");
}

describe("missing or empty pages directory", () => {
  it("returns an empty manifest when pages/ does not exist", () => {
    const root = makeProject();

    expect(discoverPages(root)).toEqual([]);
  });

  it("returns an empty manifest when pages/ is empty", () => {
    const root = makeProject();
    mkdirSync(join(root, "pages"));

    expect(discoverPages(root)).toEqual([]);
  });
});

describe("route mapping", () => {
  it("maps pages/index.md to the root route", () => {
    const root = makeProject();
    writeFile(root, "pages/index.md");

    expect(discoverPages(root)).toEqual([
      { route: "/", file: "pages/index.md", isIndex: true },
    ]);
  });

  it("maps a nested index.md to its directory route", () => {
    const root = makeProject();
    writeFile(root, "pages/nested/index.md");

    expect(discoverPages(root)).toEqual([
      { route: "/nested", file: "pages/nested/index.md", isIndex: true },
    ]);
  });

  it("maps named pages to their path routes, nested or not", () => {
    const root = makeProject();
    writeFile(root, "pages/about.md");
    writeFile(root, "pages/nested/page.md");

    expect(discoverPages(root)).toEqual([
      { route: "/about", file: "pages/about.md", isIndex: false },
      {
        route: "/nested/page",
        file: "pages/nested/page.md",
        isIndex: false,
      },
    ]);
  });

  it("matches .mdx files as well as .md", () => {
    const root = makeProject();
    writeFile(root, "pages/guide.mdx");
    writeFile(root, "pages/index.mdx");

    expect(discoverPages(root)).toEqual([
      { route: "/", file: "pages/index.mdx", isIndex: true },
      { route: "/guide", file: "pages/guide.mdx", isIndex: false },
    ]);
  });
});

describe("filtering", () => {
  it("ignores non-markdown files anywhere under pages/", () => {
    const root = makeProject();
    writeFile(root, "pages/index.md");
    writeFile(root, "pages/notes.txt");
    writeFile(root, "pages/data/orders.csv");
    writeFile(root, "pages/logo.png");

    expect(discoverPages(root).map((entry) => entry.file)).toEqual([
      "pages/index.md",
    ]);
  });

  it("ignores node_modules and dot-prefixed paths", () => {
    const root = makeProject();
    writeFile(root, "pages/index.md");
    writeFile(root, "pages/node_modules/pkg/readme.md");
    writeFile(root, "pages/.hidden/secret.md");
    writeFile(root, "pages/.draft.md");

    expect(discoverPages(root).map((entry) => entry.file)).toEqual([
      "pages/index.md",
    ]);
  });
});

describe("front-matter", () => {
  it("reads title and sidebar_position into the manifest entry", () => {
    const root = makeProject();
    writeProjectFile(
      root,
      "pages/report.md",
      "---\ntitle: Sales Report\nsidebar_position: 2\n---\n# Report\n",
    );

    expect(discoverPages(root)).toEqual([
      {
        route: "/report",
        file: "pages/report.md",
        isIndex: false,
        title: "Sales Report",
        sidebarPosition: 2,
      },
    ]);
  });

  it("leaves nav fields absent on pages without front-matter", () => {
    const root = makeProject();
    writeFile(root, "pages/plain.md");

    const [entry] = discoverPages(root);
    expect(entry!.title).toBeUndefined();
    expect(entry!.sidebarPosition).toBeUndefined();
  });

  it("coerces a non-string title the way the page compiler does", () => {
    const root = makeProject();
    writeProjectFile(root, "pages/year.md", "---\ntitle: 2024\n---\n# Year\n");

    expect(discoverPages(root)[0]!.title).toBe("2024");
  });

  it("drops a non-number sidebar_position", () => {
    const root = makeProject();
    writeProjectFile(
      root,
      "pages/a.md",
      "---\nsidebar_position: soon\n---\n# A\n",
    );

    expect(discoverPages(root)[0]!.sidebarPosition).toBeUndefined();
  });

  it("throws naming the file when front-matter is not a mapping", () => {
    const root = makeProject();
    writeProjectFile(root, "pages/bad.md", "---\n- a\n- b\n---\n# Bad\n");

    expect(() => discoverPages(root)).toThrow(
      /Invalid front-matter in pages\/bad\.md.*YAML mapping.*array/,
    );
  });

  it("throws naming the file when front-matter is malformed yaml", () => {
    const root = makeProject();
    writeProjectFile(root, "pages/bad.md", "---\ntitle: [unclosed\n---\n");

    expect(() => discoverPages(root)).toThrow(
      /^Invalid front-matter in pages\/bad\.md:2:17: Flow sequence[^]* must be sufficiently indented and end with a \]:\n/,
    );
  });
});

describe("manifest shape", () => {
  it("sorts entries by route with the root page first", () => {
    const root = makeProject();
    writeFile(root, "pages/b.md");
    writeFile(root, "pages/a/x.md");
    writeFile(root, "pages/index.md");

    expect(discoverPages(root).map((entry) => entry.route)).toEqual([
      "/",
      "/a/x",
      "/b",
    ]);
  });

  it("throws naming both files when two pages map to the same route", () => {
    const root = makeProject();
    writeFile(root, "pages/foo.md");
    writeFile(root, "pages/foo/index.md");

    expect(() => discoverPages(root)).toThrow(
      'Duplicate page route "/foo" produced by "pages/foo.md" and "pages/foo/index.md"',
    );
  });
});
