import { ConfigFieldError } from "./biac-config-error.js";
import { readBrand } from "./brand-config.js";
import { brandedThemeTokens } from "./brand-contrast.js";
import type { BrandTheme, PageFrontmatter } from "./types.js";

/**
 * Reads a page's front-matter `brand:` with the same shape and contrast
 * rules as `biac.config.ts`'s. Only the keys the page sets are returned:
 * its stylesheet follows the project's, so the cascade keeps every project
 * colour the page leaves out. Its colours are measured against the project
 * brand they land on, and a failure names the page file.
 *
 * @example
 * pageBrand({ brand: { palette: { light: ["#1e40af"] } } }, "front-matter in pages/a.md", projectBrand);
 * // → { colors: {}, palette: { light: ["#1e40af"] }, scale: {}, fonts: {} }
 */
export function pageBrand(
  frontmatter: PageFrontmatter,
  location: string,
  projectBrand: BrandTheme,
): BrandTheme {
  try {
    return readBrand(frontmatter, brandedThemeTokens(projectBrand));
  } catch (error) {
    if (!(error instanceof ConfigFieldError)) throw error;
    throw new Error(`Invalid ${location} — ${error.message}`);
  }
}
