import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverPages } from "./discover-pages.js";

let projectRoot: string | undefined;

afterEach(() => {
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  projectRoot = undefined;
});

function makeProject(): string {
  projectRoot = mkdtempSync(join(tmpdir(), "biac-pages-"));
  return projectRoot;
}

function writeFile(projectRoot: string, relativePath: string): void {
  const file = join(projectRoot, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "# Page\n");
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
