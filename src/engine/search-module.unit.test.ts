import { describe, expect, it } from "vitest";
import { searchDocument, searchModuleSource } from "./search-module.js";
import type { PageManifestEntry } from "./types.js";

const ENTRY: PageManifestEntry = {
  route: "/nested/allocation",
  file: "pages/nested/allocation.md",
  isIndex: false,
};

describe("searchDocument", () => {
  it("indexes the page's route, sidebar name, text and keywords", () => {
    const markdown =
      "---\nkeywords: [margin, split]\n---\n# Allocation\n\nBy channel.\n";

    const document = searchDocument(ENTRY, markdown, {});

    expect(document).toEqual({
      id: "/nested/allocation",
      title: "Allocation",
      text: "Allocation By channel.",
      keywords: "margin, split",
    });
  });

  it("leaves a page with index: false out", () => {
    const markdown = "---\nindex: false\n---\n# Allocation\n";

    expect(searchDocument(ENTRY, markdown, {})).toBeUndefined();
  });

  it("resolves translated text from the given language", () => {
    const markdown = "# {$translations.title}\n";

    const document = searchDocument(ENTRY, markdown, { title: "Répartition" });

    expect(document?.text).toBe("Répartition");
  });

  it("keeps a page whose body does not parse, by its name and keywords", () => {
    const markdown = "---\nkeywords: margin\n---\n# Broken <Callout\n";

    const document = searchDocument(ENTRY, markdown, {});

    expect(document).toMatchObject({ title: "Allocation", text: "" });
  });
});

describe("searchModuleSource", () => {
  it("exports the documents as JSON", () => {
    const documents = [{ id: "/", title: "Home", text: "Hi", keywords: "" }];

    const source = searchModuleSource(documents);

    expect(source).toBe(
      'export const documents = [{"id":"/","title":"Home","text":"Hi","keywords":""}];\n',
    );
  });
});
