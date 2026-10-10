import { describe, expect, it } from "vitest";
import { manifestModuleSource } from "./manifest-module.js";
import type { PageManifestEntry } from "./types.js";

const index: PageManifestEntry = {
  route: "/",
  file: "pages/index.md",
  isIndex: true,
  title: "Home",
};
const report: PageManifestEntry = {
  route: "/report",
  file: "pages/report.md",
  isIndex: false,
  sidebarPosition: 2,
};

describe("manifest entries", () => {
  it("serves each page's route, file and nav fields", () => {
    const source = manifestModuleSource([index, report]);

    expect(source).toContain(
      '{ route: "/", file: "pages/index.md", isIndex: true, title: "Home", load:',
    );
    expect(source).toContain(
      '{ route: "/report", file: "pages/report.md", isIndex: false, sidebarPosition: 2, load:',
    );
  });

  it("loads a hot-swapped module before falling back to the lazy import", () => {
    const source = manifestModuleSource([report]);

    expect(source).toContain(
      'load: async () => hotPageModules.get("pages/report.md") ?? import("virtual:biac-page/pages/report.md")',
    );
  });

  it("exports the nav tree built from the entries", () => {
    const source = manifestModuleSource([index]);

    expect(source).toContain(
      'export const navTree = {"rootPages":[{"name":"Home","href":"/"}],"directories":[]};',
    );
  });
});

describe("hot page updates", () => {
  it("accepts every page module as a literal HMR dependency", () => {
    const source = manifestModuleSource([index, report]);

    expect(source).toContain(
      'import.meta.hot.accept(["virtual:biac-page/pages/index.md", "virtual:biac-page/pages/report.md"],',
    );
  });

  it("guards the accept block so a production build drops it", () => {
    const source = manifestModuleSource([index]);

    expect(source).toMatch(
      /if \(import\.meta\.hot\) \{\n {2}import\.meta\.hot\.accept/,
    );
  });

  it("exports a page-update subscription even when there are no pages", () => {
    const source = manifestModuleSource([]);

    expect(source).toContain("export function subscribePageUpdates(listener)");
    expect(source).not.toContain("import.meta.hot");
  });
});
