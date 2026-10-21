import { invalidSetting } from "./invalid-setting.js";
import type { PageFrontmatter, PageSearchFields } from "./types.js";

/**
 * Checks a page's search front-matter: `index` is a boolean (`false` keeps
 * the page out of site search) and `keywords` a string or a list of strings.
 * Absent or `null` means the default. A wrong shape fails naming the file,
 * since a silently ignored `index: "no"` would leave the page searchable.
 *
 * @example
 * assertPageSearchFields({ index: "no" }, "front-matter in pages/a.md");
 * // throws: Invalid front-matter in pages/a.md — index: expected true | false, got "no"
 */
export function assertPageSearchFields(
  frontmatter: PageFrontmatter,
  location: string,
): void {
  const { index, keywords } = frontmatter;
  if (index != null && typeof index !== "boolean") {
    throw invalidSetting(location, "index", "true | false", index);
  }
  if (keywords != null && keywordList(keywords) === undefined) {
    const expected = "a string or a list of strings";
    throw invalidSetting(location, "keywords", expected, keywords);
  }
}

/**
 * The search fields the index reads, tolerant of bad values the way the
 * nav reads `icon`: a malformed `index` keeps the page in and malformed
 * `keywords` are dropped, while `assertPageSearchFields` reports both when
 * the page compiles.
 *
 * @example
 * pageSearchFields({ keywords: ["margin", "allocation"] });
 * // → { indexed: true, keywords: "margin, allocation" }
 */
export function pageSearchFields(
  frontmatter: PageFrontmatter,
): PageSearchFields {
  return {
    indexed: frontmatter.index !== false,
    keywords: (keywordList(frontmatter.keywords) ?? []).join(", "),
  };
}

function keywordList(keywords: unknown): string[] | undefined {
  if (keywords == null) return [];
  if (typeof keywords === "string") return [keywords];
  if (!Array.isArray(keywords)) return;
  return keywords.every((keyword) => typeof keyword === "string")
    ? keywords
    : undefined;
}
