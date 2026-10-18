import { invalidSetting } from "./invalid-setting.js";
import type {
  LayoutSwitch,
  PageFrontmatter,
  PageLayout,
  PageWidth,
} from "./types.js";

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
 * pageLayout({ page_width: "full", table_of_contents: false }, "front-matter in pages/a.md");
 * // → { page_width: "full", table_of_contents: false }
 */
export function pageLayout(
  frontmatter: PageFrontmatter,
  location: string,
): PageLayout {
  return {
    ...pageWidth(frontmatter.page_width, location),
    ...pageSwitch(frontmatter, "cards", location),
    ...pageSwitch(frontmatter, "table_of_contents", location),
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
function pageSwitch(
  frontmatter: PageFrontmatter,
  key: LayoutSwitch,
  location: string,
): PageLayout {
  const value = frontmatter[key];
  if (value === undefined) return {};
  if (typeof value !== "boolean") {
    throw invalidSetting(location, key, "a boolean", value);
  }
  return { [key]: value };
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
