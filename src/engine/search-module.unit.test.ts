import { describe, expect, it } from "vitest";
import {
  searchablePage,
  searchDocumentIn,
  searchDocumentSets,
  searchModuleSource,
} from "./search-module.js";
import type {
  PageManifestEntry,
  SearchDocument,
  SearchDocumentSets,
} from "./types.js";

const ENTRY: PageManifestEntry = {
  route: "/nested/allocation",
  file: "pages/nested/allocation.md",
  isIndex: false,
};

function searchDocument(
  entry: PageManifestEntry,
  markdown: string,
  translations: Record<string, string>,
): SearchDocument | undefined {
  const page = searchablePage(entry, markdown);
  return page && searchDocumentIn(page, translations);
}

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

describe("searchDocumentSets", () => {
  const page = searchablePage(ENTRY, "# {$translations.title}\n")!;

  it("gives each declared language its own resolved documents", () => {
    const resolved = {
      languages: ["en", "fr"],
      byLanguage: { en: { title: "Allocation" }, fr: { title: "Répartition" } },
    };

    const sets = searchDocumentSets([page], resolved);

    expect(sets.languages).toEqual(["en", "fr"]);
    expect(sets.byLanguage.en?.[0]?.text).toBe("Allocation");
    expect(sets.byLanguage.fr?.[0]?.text).toBe("Répartition");
  });

  it("gives one untranslated set when no language is declared", () => {
    const sets = searchDocumentSets([page], undefined);

    expect(sets).toEqual({
      languages: [],
      byLanguage: { "": [searchDocumentIn(page, {})] },
    });
  });
});

interface SearchModule {
  searchDocumentsFor(language: string | undefined): SearchDocument[];
  subscribeSearchDocuments(listener: () => void): () => void;
}

async function importModule(sets: SearchDocumentSets): Promise<SearchModule> {
  const source = searchModuleSource(sets);
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

function titled(title: string): SearchDocument {
  return { id: "/", title, text: "", keywords: "" };
}

describe("virtual:biac-search", () => {
  const sets: SearchDocumentSets = {
    languages: ["en", "fr"],
    byLanguage: { en: [titled("Home")], fr: [titled("Accueil")] },
  };

  it("serves the documents of the asked language", async () => {
    const module = await importModule(sets);

    expect(module.searchDocumentsFor("fr")).toEqual([titled("Accueil")]);
  });

  it("serves the first declared language's for an unknown one", async () => {
    const module = await importModule(sets);

    expect(module.searchDocumentsFor("constructor")).toEqual([titled("Home")]);
  });

  it("serves the untranslated set when no language is declared", async () => {
    const module = await importModule({
      languages: [],
      byLanguage: { "": [titled("Home")] },
    });

    expect(module.searchDocumentsFor(undefined)).toEqual([titled("Home")]);
  });

  it("gives the same documents on every read, as a store snapshot must", async () => {
    const module = await importModule(sets);

    expect(module.searchDocumentsFor("en")).toBe(
      module.searchDocumentsFor("en"),
    );
  });
});
