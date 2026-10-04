import { existsSync, globSync } from "node:fs";
import { join, sep } from "node:path";
import { basename, dirname } from "node:path/posix";
import type { PageManifestEntry } from "./types.js";

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
    const entry = toEntry(file.split(sep).join("/"));
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

function toEntry(relativeFile: string): PageManifestEntry {
  const stem = relativeFile.replace(/\.(md|mdx)$/, "");
  const file = `pages/${relativeFile}`;
  if (basename(stem) !== "index") {
    return { route: `/${stem}`, file, isIndex: false };
  }
  const dir = dirname(stem);
  const route = dir === "." ? "/" : `/${dir}`;
  return { route, file, isIndex: true };
}
