import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VFile } from "vfile";
import { discoverPages } from "./discover-pages.js";
import { hotStoreSource } from "./hot-store-source.js";
import { pageNavName } from "./nav-tree.js";
import { pageFrontmatter, parseFrontmatterBlock } from "./page-frontmatter.js";
import { pageSearchFields } from "./page-search-frontmatter.js";
import { pageProse, proseText, type PageProse } from "./page-search-text.js";
import type {
  PageManifestEntry,
  ResolvedTranslations,
  SearchDocument,
  SearchDocumentSets,
  TranslationMap,
} from "./types.js";

/** The module the sidebar's search box imports its documents from. */
export const VIRTUAL_SEARCH_ID = "virtual:biac-search";

// The key of the one document set a project without declared languages has.
const UNTRANSLATED = "";

/** A page's search fields, its prose parsed once for every language. */
export interface SearchablePage {
  readonly id: string;
  readonly title: string;
  readonly keywords: string;
  readonly prose: PageProse;
}

/**
 * Source of `virtual:biac-search`: the searchable pages in each declared
 * language, as a store — `searchDocumentsFor(language)` gives the
 * language's set (the first declared language's for one not declared, the
 * untranslated set without any) and `subscribeSearchDocuments` hears of a
 * hot update. The browser builds the index from them on the box's first
 * focus, so the term options live in one place and the module stays plain
 * data. In dev the module hot-updates itself ({@link hotStoreSource}), so a
 * saved page reaches an open search box without a reload.
 *
 * @example
 * searchModuleSource({ languages: [], byLanguage: { "": [{ id: "/", title: "Home", text: "Hi", keywords: "" }] } });
 * // → 'const store = …;\nObject.assign(store, {"languages":[],"byLanguage":{"":[…]}});\n…'
 */
export function searchModuleSource(sets: SearchDocumentSets): string {
  return [
    ...hotStoreSource({ ...sets }, "subscribeSearchDocuments"),
    "export function searchDocumentsFor(language) {",
    // `hasOwn`, not `in`: a language read from a URL may be "constructor".
    "  if (Object.hasOwn(store.byLanguage, language)) return store.byLanguage[language];",
    `  return store.byLanguage[store.languages[0] ?? ${JSON.stringify(UNTRANSLATED)}] ?? [];`,
    "}",
    "",
  ].join("\n");
}

/**
 * Every page under `projectRoot`'s `pages/` as search documents in each
 * language `resolved` declares (one untranslated set when it is
 * undefined). Pages with `index: false` are left out; one deleted mid-edit
 * is skipped, as the manifest skips it.
 *
 * @example
 * projectSearchDocuments("/site", undefined);
 * // → { languages: [], byLanguage: { "": [{ id: "/", title: "Home", … }] } }
 */
export function projectSearchDocuments(
  projectRoot: string,
  resolved: ResolvedTranslations | undefined,
): SearchDocumentSets {
  const pages = discoverPages(projectRoot).flatMap((entry) => {
    const markdown = readPageSource(join(projectRoot, entry.file));
    if (markdown === undefined) return [];
    return searchablePage(entry, markdown) ?? [];
  });
  return searchDocumentSets(pages, resolved);
}

/**
 * `pages` resolved once per language `resolved` declares, or once with no
 * translations when it is undefined.
 *
 * @example
 * searchDocumentSets(pages, { languages: ["en"], byLanguage: { en: {} } });
 * // → { languages: ["en"], byLanguage: { en: [{ id: "/", … }] } }
 */
export function searchDocumentSets(
  pages: readonly SearchablePage[],
  resolved: ResolvedTranslations | undefined,
): SearchDocumentSets {
  const languages = resolved?.languages ?? [];
  const keys = languages.length > 0 ? languages : [UNTRANSLATED];
  const byLanguage = Object.fromEntries(
    keys.map((language) => {
      const translations = resolved?.byLanguage[language] ?? {};
      return [
        language,
        pages.map((page) => searchDocumentIn(page, translations)),
      ];
    }),
  );
  return { languages, byLanguage };
}

/**
 * One page's search fields, named as its sidebar link is; undefined when
 * its front-matter sets `index: false`.
 *
 * @example
 * searchablePage({ route: "/a", file: "pages/a.md", isIndex: false }, "# A\n");
 * // → { id: "/a", title: "A", keywords: "", prose: ["A"] }
 */
export function searchablePage(
  entry: PageManifestEntry,
  markdown: string,
): SearchablePage | undefined {
  const file = new VFile({ path: entry.file, value: markdown });
  parseFrontmatterBlock(file, { strip: true });
  const { indexed, keywords } = pageSearchFields(pageFrontmatter(file));
  if (!indexed) return;
  const prose = bodyProse(String(file.value));
  return { id: entry.route, title: pageNavName(entry), keywords, prose };
}

/**
 * `page` as the document the browser indexes, its text in `translations`.
 *
 * @example
 * searchDocumentIn({ id: "/", title: "Home", keywords: "", prose: [{ key: "t" }] }, { t: "Hi" });
 * // → { id: "/", title: "Home", text: "Hi", keywords: "" }
 */
export function searchDocumentIn(
  page: SearchablePage,
  translations: TranslationMap,
): SearchDocument {
  const { id, title, keywords, prose } = page;
  return { id, title, text: proseText(prose, translations), keywords };
}

// A page mid-edit whose MDX does not parse shows its compile error on its
// own route; search keeps finding it by name and keywords meanwhile rather
// than failing for every page. The MDX parser throws syntax errors as
// vfile-message `VFileMessage`s, which carry a `ruleId`; anything else is
// a bug and propagates.
function bodyProse(body: string): PageProse {
  try {
    return pageProse(body);
  } catch (error) {
    if (error instanceof Error && "ruleId" in error) return [];
    throw error;
  }
}

function readPageSource(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}
