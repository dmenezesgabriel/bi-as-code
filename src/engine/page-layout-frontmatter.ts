import { invalidSetting } from "./invalid-setting.js";
import type { PageFrontmatter, PageLayout, PageWidth } from "./types.js";

const PAGE_WIDTHS: readonly PageWidth[] = ["article", "full"];

/**
 * Reads a page's layout keys out of its front-matter. A value outside the
 * accepted set fails naming the file, rather than being dropped for the
 * default: a silently ignored `page_width: wide` looks like a layout bug,
 * not a typo.
 *
 * @example
 * pageLayout({ page_width: "full" }, "front-matter in pages/a.md");
 * // → { page_width: "full" }
 */
export function pageLayout(
  frontmatter: PageFrontmatter,
  location: string,
): PageLayout {
  const width = frontmatter.page_width;
  if (width === undefined) return {};
  if (!isPageWidth(width)) {
    throw invalidSetting(
      location,
      "page_width",
      PAGE_WIDTHS.map((name) => JSON.stringify(name)).join(" | "),
      width,
    );
  }
  return { page_width: width };
}

function isPageWidth(value: unknown): value is PageWidth {
  return PAGE_WIDTHS.includes(value as PageWidth);
}
