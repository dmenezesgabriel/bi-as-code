import { readFileSync } from "node:fs";
import { VFile } from "vfile";
import { matter } from "vfile-matter";
import type { PageFrontmatter } from "./types.js";

/**
 * Reads a page's YAML front-matter from disk without compiling the page —
 * the manifest builder's view of the page. `displayPath` (the
 * project-relative `pages/...` path) names the file in errors so discovery
 * failures read like compile failures. A file with no front-matter yields
 * `{}`; malformed YAML throws naming the file.
 *
 * @example
 * readPageFrontmatter("/site/pages/a.md", "pages/a.md");
 * // → { title: "A", sidebar_position: 1 }
 */
export function readPageFrontmatter(
  absolutePath: string,
  displayPath: string,
): PageFrontmatter {
  const file = new VFile({
    path: displayPath,
    value: readFileSync(absolutePath, "utf-8"),
  });
  try {
    matter(file);
  } catch (error) {
    throw new Error(
      `Invalid front-matter in ${displayPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return pageFrontmatter(file);
}

/**
 * Validates a VFile's parsed `data.matter` is a YAML mapping — front-matter
 * written as a scalar or array is an author error worth failing loudly on.
 *
 * @example
 * matter(vfile, { strip: true });
 * const fm = pageFrontmatter(vfile); // throws if fm was `- a\n- b`
 */
export function pageFrontmatter(file: VFile): PageFrontmatter {
  const parsed: unknown = file.data.matter;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `Invalid front-matter in ${file.path}: expected a YAML mapping, got ${
        Array.isArray(parsed) ? "an array" : typeof parsed
      }`,
    );
  }
  return parsed as PageFrontmatter;
}
