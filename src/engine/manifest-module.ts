import { buildNavTree } from "./nav-tree.js";
import type { PageManifestEntry } from "./types.js";

/** Module id prefix that resolves to one page file under `pages/`. */
export const VIRTUAL_PAGE_PREFIX = "virtual:biac-page/";

/**
 * Source of the `virtual:biac-pages` module: one entry per page with a lazy
 * `load`, the sidebar `navTree`, and `subscribePageUpdates`.
 *
 * In dev the manifest is the HMR boundary for page edits: it accepts every
 * page module as a dependency, so a content edit stops propagating here
 * instead of dead-ending into a full reload. The accept callback receives
 * the re-fetched page module, `load` serves it from then on, and listeners
 * (the router) re-run their loaders. `import.meta.hot` is undefined in a
 * production build, so the guarded block is dropped there.
 *
 * @example
 * manifestModuleSource([{ route: "/", file: "pages/index.md", isIndex: true }]);
 * // → "const hotPageModules = new Map();\n…export const pages = [\n  { route: \"/\", …"
 */
export function manifestModuleSource(entries: PageManifestEntry[]): string {
  return [
    "const hotPageModules = new Map();",
    "const pageUpdateListeners = new Set();",
    `export const pages = [\n${entries.map(entryRow).join(",\n")}\n];`,
    `export const navTree = ${JSON.stringify(buildNavTree(entries))};`,
    "export function subscribePageUpdates(listener) {",
    "  pageUpdateListeners.add(listener);",
    "  return () => void pageUpdateListeners.delete(listener);",
    "}",
    ...hotAcceptBlock(entries),
  ].join("\n");
}

function entryRow(entry: PageManifestEntry): string {
  const file = JSON.stringify(entry.file);
  const fields = [
    `route: ${JSON.stringify(entry.route)}`,
    `file: ${file}`,
    `isIndex: ${entry.isIndex}`,
    entry.title === undefined ? null : `title: ${JSON.stringify(entry.title)}`,
    entry.sidebarPosition === undefined
      ? null
      : `sidebarPosition: ${JSON.stringify(entry.sidebarPosition)}`,
    `load: async () => hotPageModules.get(${file}) ?? import(${pageId(entry)})`,
  ];
  return `  { ${fields.filter(Boolean).join(", ")} }`;
}

/**
 * Vite reads accepted dependencies only from string literals, so every page
 * id is spelled out. A manifest without pages accepts nothing — adding the
 * first page changes the manifest, which reloads anyway.
 */
function hotAcceptBlock(entries: PageManifestEntry[]): string[] {
  if (entries.length === 0) return [];
  return [
    "if (import.meta.hot) {",
    `  import.meta.hot.accept([${entries.map(pageId).join(", ")}], (modules) => {`,
    `    const files = ${JSON.stringify(entries.map((entry) => entry.file))};`,
    "    modules.forEach((mod, i) => mod && hotPageModules.set(files[i], mod));",
    "    pageUpdateListeners.forEach((listener) => listener());",
    "  });",
    "}",
    "",
  ];
}

function pageId(entry: PageManifestEntry): string {
  return JSON.stringify(VIRTUAL_PAGE_PREFIX + entry.file);
}
