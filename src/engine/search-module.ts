import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VFile } from "vfile";
import { discoverPages } from "./discover-pages.js";
import { pageNavName } from "./nav-tree.js";
import { pageFrontmatter, parseFrontmatterBlock } from "./page-frontmatter.js";
import { pageSearchFields } from "./page-search-frontmatter.js";
import { pageSearchText } from "./page-search-text.js";
import type {
  PageManifestEntry,
  ResolvedTranslations,
  SearchDocument,
  TranslationMap,
} from "./types.js";

/** The module the sidebar's search box imports its documents from. */
export const VIRTUAL_SEARCH_ID = "virtual:biac-search";

/**
 * Source of `virtual:biac-search`: one document per searchable page. The
 * browser builds the index from them on the box's first focus, so the
 * term options live in one place and the module stays plain data.
 *
 * @example
 * searchModuleSource([{ id: "/", title: "Home", text: "Hi", keywords: "" }]);
 * // → 'export const documents = [{"id":"/","title":"Home","text":"Hi","keywords":""}];\n'
 */
export function searchModuleSource(
  documents: readonly SearchDocument[],
): string {
  return `export const documents = ${JSON.stringify(documents)};\n`;
}

/**
 * Every page under `projectRoot`'s `pages/` as a search document, its
 * translated text in the first declared language of `resolved` (none when
 * `resolved` is undefined). Pages with `index: false` are left out; one
 * deleted mid-edit is skipped, as the manifest skips it.
 *
 * @example
 * projectSearchDocuments("/site", NO_TRANSLATIONS);
 * // → [{ id: "/", title: "Home", text: "…", keywords: "" }, …]
 */
export function projectSearchDocuments(
  projectRoot: string,
  resolved: ResolvedTranslations | undefined,
): SearchDocument[] {
  const translations = defaultLanguageTranslations(resolved);
  return discoverPages(projectRoot).flatMap((entry) => {
    const markdown = readPageSource(join(projectRoot, entry.file));
    if (markdown === undefined) return [];
    return searchDocument(entry, markdown, translations) ?? [];
  });
}

/**
 * One page's search document, named as its sidebar link is; undefined when
 * its front-matter sets `index: false`.
 *
 * @example
 * searchDocument({ route: "/a", file: "pages/a.md", isIndex: false }, "# A\n", {});
 * // → { id: "/a", title: "A", text: "A", keywords: "" }
 */
export function searchDocument(
  entry: PageManifestEntry,
  markdown: string,
  translations: TranslationMap,
): SearchDocument | undefined {
  const file = new VFile({ path: entry.file, value: markdown });
  parseFrontmatterBlock(file, { strip: true });
  const { indexed, keywords } = pageSearchFields(pageFrontmatter(file));
  if (!indexed) return;
  const text = bodyText(String(file.value), translations);
  return { id: entry.route, title: pageNavName(entry), text, keywords };
}

// A page mid-edit whose MDX does not parse shows its compile error on its
// own route; search keeps finding it by name and keywords meanwhile rather
// than failing for every page. The MDX parser throws syntax errors as
// vfile-message `VFileMessage`s, which carry a `ruleId`; anything else is
// a bug and propagates.
function bodyText(body: string, translations: TranslationMap): string {
  try {
    return pageSearchText(body, translations);
  } catch (error) {
    if (error instanceof Error && "ruleId" in error) return "";
    throw error;
  }
}

function defaultLanguageTranslations(
  resolved: ResolvedTranslations | undefined,
): TranslationMap {
  const language = resolved?.languages[0];
  return language === undefined ? {} : (resolved?.byLanguage[language] ?? {});
}

function readPageSource(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}
