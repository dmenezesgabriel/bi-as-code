import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { loadProjectTranslations } from "@/engine/resolve-translations.js";
import { projectSearchDocuments } from "@/engine/search-module.js";
import type { SearchDocument, SearchDocumentSets } from "@/engine/types.js";
import { siteSearchExamples } from "../lib/site-search-examples.js";

const DOCS_ROOT = new URL("../../docs", import.meta.url).pathname;
const PAGE = readFileSync(`${DOCS_ROOT}/pages/sql/site-search.md`, "utf-8");
const ROUTE = "/sql/site-search";

/** What the browser's index offers this test: ranked routes for a query. */
interface BrowserPageIndex {
  search(query: string): readonly { readonly id: string }[];
}

// The SPA's index builder is loaded by path: `tsc` compiles `test/` as NodeNext
// ESM, which the SPA's extensionless imports do not satisfy, and the SPA may
// not import the engine, so this test is the one place the two meet.
const PAGE_INDEX_MODULE = fileURLToPath(
  new URL("../../src/web/src/features/search/page-index.ts", import.meta.url),
);

let sets: SearchDocumentSets;
let buildPageIndex: (documents: readonly SearchDocument[]) => BrowserPageIndex;

beforeAll(async () => {
  ({ buildPageIndex } = await import(PAGE_INDEX_MODULE));
  sets = projectSearchDocuments(
    DOCS_ROOT,
    await loadProjectTranslations(DOCS_ROOT),
  );
});

/** The routes `query` finds in `language`, best match first. */
function routesFor(query: string, language: string): string[] {
  return buildPageIndex(sets.byLanguage[language]!)
    .search(query)
    .map((result) => result.id);
}

/** The title of the page at `route`, as its sidebar link reads. */
function titleOf(route: string): string {
  return sets.byLanguage.en!.find((document) => document.id === route)!.title;
}

describe("the Site search reference", () => {
  it("names, for every example query, the page the site's own index ranks first", () => {
    // Arrange
    const rows = siteSearchExamples();

    // Act
    const firsts = rows.map(({ query }) => titleOf(routesFor(query, "en")[0]!));

    // Assert — a wrong claim would send a reader to type a query that finds something else.
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(firsts).toEqual(rows.map(({ first }) => first));
  });

  it("keeps a page with index: false out of every result", () => {
    // Arrange
    const hidden = "/pages/branded-page-example";

    // Act
    const found = routesFor("branded", "en");

    // Assert — the page is on disk and carries the front-matter key, so only `index` hides it.
    expect(readFileSync(`${DOCS_ROOT}/pages${hidden}.md`, "utf-8")).toContain(
      "index: false",
    );
    expect(found.length).toBeGreaterThan(0);
    expect(found).not.toContain(hidden);
  });

  it("finds the page by the greeting in the reader's language and not the other one's", () => {
    // Arrange — the page spells its greeting as the translation key, not as text.
    const greetingIn = (language: string, word: string) =>
      routesFor(word, language).includes(ROUTE);

    // Act / Assert — English holds the page under "hello", French under "bonjour" only.
    expect(PAGE).toContain("{$translations.greeting}");
    expect(greetingIn("en", "hello")).toBe(true);
    expect(greetingIn("fr", "bonjour")).toBe(true);
    expect(greetingIn("en", "bonjour")).toBe(false);
    expect(greetingIn("fr", "hello")).toBe(false);
  });

  it("folds accents, so a query without them finds the word with them", () => {
    // Arrange — "pesés" is spelled in the Translations page's prose.
    const accented = routesFor("pesés", "en");

    // Act
    const plain = routesFor("peses", "en");

    // Assert
    expect(accented).toContain("/sql/translations");
    expect(plain).toEqual(accented);
  });
});
