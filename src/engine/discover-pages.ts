import { existsSync, globSync } from "node:fs";
import { join, sep } from "node:path";
import { basename, dirname } from "node:path/posix";
import { readPageFrontmatter } from "./page-frontmatter.js";
import { isPageIconName } from "./page-icon-frontmatter.js";
import type { PageFrontmatter, PageManifestEntry } from "./types.js";

type NavFields = Pick<PageManifestEntry, "title" | "sidebarPosition" | "icon">;

/**
 * Maps every `.md`/`.mdx` file under `pages/` in a project root to a route
 * manifest entry — `pages/index.md` serves "/", `pages/a/index.md` serves
 * "/a", any other file serves its path. A missing or empty `pages/`
 * directory yields an empty manifest.
 *
 * @example
 * discoverPages("/site");
 * // → [{ route: "/", file: "pages/index.md", isIndex: true }]
 */
export function discoverPages(projectRoot: string): PageManifestEntry[] {
  const pagesDir = join(projectRoot, "pages");
  if (!existsSync(pagesDir)) return [];

  const files = globSync("**/*.{md,mdx}", {
    cwd: pagesDir,
    exclude: (path) => path.split("/").includes("node_modules"),
  });

  const byRoute = new Map<string, PageManifestEntry>();
  for (const file of files) {
    const relativeFile = file.split(sep).join("/");
    // A page deleted between the glob and the read (common mid-edit) is
    // skipped — the remove event invalidates the manifest for the next load.
    let frontmatter: PageFrontmatter;
    try {
      frontmatter = readPageFrontmatter(
        join(pagesDir, relativeFile),
        `pages/${relativeFile}`,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    const entry = toEntry(relativeFile, frontmatter);
    const existing = byRoute.get(entry.route);
    if (existing) {
      throw new Error(
        `Duplicate page route "${entry.route}" produced by "${existing.file}" and "${entry.file}"`,
      );
    }
    byRoute.set(entry.route, entry);
  }
  return [...byRoute.values()].sort(compareRoutes);
}

function compareRoutes(a: PageManifestEntry, b: PageManifestEntry): number {
  if (a.route === b.route) return 0;
  return a.route < b.route ? -1 : 1;
}

function toEntry(
  relativeFile: string,
  frontmatter: PageFrontmatter,
): PageManifestEntry {
  const stem = relativeFile.replace(/\.(md|mdx)$/, "");
  const file = `pages/${relativeFile}`;
  if (basename(stem) !== "index") {
    return {
      route: `/${stem}`,
      file,
      isIndex: false,
      ...navFields(frontmatter),
    };
  }
  const dir = dirname(stem);
  const route = dir === "." ? "/" : `/${dir}`;
  return { route, file, isIndex: true, ...navFields(frontmatter) };
}

/**
 * The front-matter fields nav cares about. `title` coerces like the page
 * compiler's title resolution (a numeric title renders as text); a
 * non-number `sidebar_position` and an `icon` outside the catalog are
 * dropped rather than breaking the nav — `compilePage` reports the icon.
 */
function navFields(frontmatter: PageFrontmatter): NavFields {
  const fields: NavFields = {};
  if (frontmatter.title != null) fields.title = String(frontmatter.title);
  if (typeof frontmatter.sidebar_position === "number") {
    fields.sidebarPosition = frontmatter.sidebar_position;
  }
  if (isPageIconName(frontmatter.icon)) fields.icon = frontmatter.icon;
  return fields;
}
