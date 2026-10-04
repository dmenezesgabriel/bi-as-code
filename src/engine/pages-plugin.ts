import { join, resolve, sep } from "node:path";
import type { Plugin } from "vite";
import { compilePage } from "./compile-page.js";
import { discoverPages } from "./discover-pages.js";
import type { PageManifestEntry } from "./types.js";

const VIRTUAL_MANIFEST_ID = "virtual:biac-pages";
const RESOLVED_MANIFEST_ID = `\0${VIRTUAL_MANIFEST_ID}`;
const VIRTUAL_PAGE_PREFIX = "virtual:biac-page/";

/**
 * Vite plugin that puts `pages/**\/*.{md,mdx}` inside the module graph: every
 * page compiles to an MDX module through {@link compilePage} (compile errors
 * surface in the vite overlay), and `virtual:biac-pages` serves the page
 * manifest the SPA builds its routes from. Because pages are real modules,
 * edits hot-reload through vite's normal HMR propagation; page additions and
 * removals invalidate the manifest module, which no importer accepts —
 * propagation dead-ends into a full reload and the route tree rebuilds.
 *
 * @example
 * const server = await createServer({
 *   root: webDir,
 *   plugins: [pagesPlugin(process.cwd())],
 * });
 */
export function pagesPlugin(projectRoot: string): Plugin {
  const root = resolve(projectRoot);
  const pagesDir = join(root, "pages");
  const pagesDirPosix = toPosix(pagesDir);

  return {
    name: "biac:pages",
    config() {
      return {
        resolve: {
          // Page modules compile under the project root, outside the vite
          // root's node_modules reach — dedupe forces react to resolve from
          // the web root so pages and the SPA share one runtime copy.
          dedupe: ["react", "react-dom"],
        },
      };
    },
    configResolved(config) {
      // Pages live outside the vite root, so /@fs/ requests need the project
      // root allowed — without it every page module 403s outside the vite
      // workspace root.
      config.server.fs.allow.push(root);
    },
    resolveId(id) {
      if (id === VIRTUAL_MANIFEST_ID) return RESOLVED_MANIFEST_ID;
      if (!id.startsWith(VIRTUAL_PAGE_PREFIX)) return;
      const file = join(root, id.slice(VIRTUAL_PAGE_PREFIX.length));
      if (!toPosix(file).startsWith(`${pagesDirPosix}/`)) return null;
      return file;
    },
    load(id) {
      if (id !== RESOLVED_MANIFEST_ID) return;
      return manifestModuleSource(discoverPages(root));
    },
    async transform(code, id) {
      if (!isPageFile(id, pagesDirPosix)) return;
      const file = `pages/${toPosix(id).slice(pagesDirPosix.length + 1)}`;
      const page = await compilePage(code, file);
      return { code: page.code, map: null };
    },
    configureServer(server) {
      server.watcher.add(pagesDir);
    },
    hotUpdate({ type, file, modules }) {
      if (!isPageFile(file, pagesDirPosix)) return;
      // Edits need nothing extra: the invalidated page module has no HMR
      // boundary upstream, so default propagation already ends in a reload.
      if (type === "update") return;
      const graph = this.environment.moduleGraph;
      const manifest = graph.getModuleById(RESOLVED_MANIFEST_ID);
      if (!manifest) return;
      graph.invalidateModule(manifest);
      return [...modules, manifest];
    },
  };
}

function manifestModuleSource(entries: PageManifestEntry[]): string {
  const rows = entries.map(
    (entry) =>
      `  { route: ${JSON.stringify(entry.route)}, file: ${JSON.stringify(
        entry.file,
      )}, isIndex: ${entry.isIndex}, load: () => import(${JSON.stringify(
        VIRTUAL_PAGE_PREFIX + entry.file,
      )}) }`,
  );
  return `export const pages = [\n${rows.join(",\n")}\n];\n`;
}

const VITE_INTERNAL_QUERY_PARAMS = new Set(["import", "t", "v"]);

function isPageFile(id: string, pagesDirPosix: string): boolean {
  const [file, query] = toPosix(id).split("?");
  if (!file?.startsWith(`${pagesDirPosix}/`)) return false;
  if (!file.endsWith(".md") && !file.endsWith(".mdx")) return false;
  // importAnalysis rewrites lazy page imports to `....md?import` — vite-internal
  // queries still compile; foreign ones (`?raw`, `?url`) pass through raw.
  return (
    !query ||
    query
      .split("&")
      .every((param) => VITE_INTERNAL_QUERY_PARAMS.has(param.split("=")[0]!))
  );
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}
