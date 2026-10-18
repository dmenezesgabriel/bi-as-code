import { invalidSetting } from "./invalid-setting.js";
import type { PageFrontmatter, PageLayout, PageWidth } from "./types.js";

const PAGE_WIDTHS: readonly PageWidth[] = ["article", "full"];

/** The accepted `page_width` values as an error message names them. */
export const PAGE_WIDTH_CHOICES = PAGE_WIDTHS.map((name) =>
  JSON.stringify(name),
).join(" | ");

/**
 * Reads a page's layout keys out of its front-matter. A value outside the
 * accepted set fails naming the file, rather than being dropped for the
 * default: a silently ignored `page_width: wide` looks like a layout bug,
 * not a typo.
 *
 * @example
 * pageLayout({ page_width: "full", cards: true }, "front-matter in pages/a.md");
 * // → { page_width: "full", cards: true }
 */
export function pageLayout(
  frontmatter: PageFrontmatter,
  location: string,
): PageLayout {
  return {
    ...pageWidth(frontmatter.page_width, location),
    ...pageCards(frontmatter.cards, location),
  };
}

function pageWidth(width: unknown, location: string): PageLayout {
  if (width === undefined) return {};
  if (!isPageWidth(width)) {
    throw invalidSetting(location, "page_width", PAGE_WIDTH_CHOICES, width);
  }
  return { page_width: width };
}

// Strictly a boolean: YAML already reads `true`/`false`, so a string here is
// a typo such as `cards: yes please`, not a value to coerce.
function pageCards(cards: unknown, location: string): PageLayout {
  if (cards === undefined) return {};
  if (typeof cards !== "boolean") {
    throw invalidSetting(location, "cards", "a boolean", cards);
  }
  return { cards };
}

/**
 * True for a value `page_width` accepts, wherever it is declared.
 *
 * @example
 * isPageWidth("full"); // → true
 */
export function isPageWidth(value: unknown): value is PageWidth {
  return PAGE_WIDTHS.includes(value as PageWidth);
}
