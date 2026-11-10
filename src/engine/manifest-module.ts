import { ConfigFieldError, locatedError } from "./biac-config-error.js";
import { checkDirectoryTitles } from "./directory-titles.js";
import { discoverPages } from "./discover-pages.js";
import { buildNavTree } from "./nav-tree.js";
import type {
  BiacConfig,
  DirectoryTitles,
  PageManifestEntry,
} from "./types.js";

/** Module id prefix that resolves to one page file under `pages/`. */
export const VIRTUAL_PAGE_PREFIX = "virtual:biac-page/";

/**
 * Source of the `virtual:biac-pages` module: one entry per page with a lazy
 * `load`, the sidebar `navTree` (folders named by `directories`), and `subscribePageUpdates`.
 *
 * In dev the manifest is the HMR boundary for page edits: it accepts every
 * page module as a dependency, so a content edit stops propagating here
 * instead of dead-ending into a full reload. The accept callback receives
 * the re-fetched page module, `load` serves it from then on, and listeners
 * (the router) re-run their loaders. `import.meta.hot` is undefined in a
 * production build, so the guarded block is dropped there.
 *
 * @example
 * manifestModuleSource([{ route: "/", file: "pages/index.md", isIndex: true }], {});
 * // → "const hotPageModules = new Map();\n…export const pages = [\n  { route: \"/\", …"
 */
export function manifestModuleSource(
  entries: PageManifestEntry[],
  directories: DirectoryTitles,
): string {
  return [
    "const hotPageModules = new Map();",
    "const pageUpdateListeners = new Set();",
    `export const pages = [\n${entries.map(entryRow).join(",\n")}\n];`,
    `export const navTree = ${jsLiteral(buildNavTree(entries, directories))};`,
    "export function subscribePageUpdates(listener) {",
    "  pageUpdateListeners.add(listener);",
    "  return () => void pageUpdateListeners.delete(listener);",
    "}",
    ...hotAcceptBlock(entries),
  ].join("\n");
}

function entryRow(entry: PageManifestEntry): string {
  const file = jsLiteral(entry.file);
  const fields = [
    `route: ${jsLiteral(entry.route)}`,
    `file: ${file}`,
    `isIndex: ${entry.isIndex}`,
    entry.title === undefined ? null : `title: ${jsLiteral(entry.title)}`,
    entry.sidebarPosition === undefined
      ? null
      : `sidebarPosition: ${jsLiteral(entry.sidebarPosition)}`,
    entry.sidebar === undefined ? null : `sidebar: ${entry.sidebar}`,
    entry.header === undefined ? null : `header: ${entry.header}`,
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
    `    const files = ${jsLiteral(entries.map((entry) => entry.file))};`,
    "    modules.forEach((mod, i) => mod && hotPageModules.set(files[i], mod));",
    "    pageUpdateListeners.forEach((listener) => listener());",
    "  });",
    "}",
    "",
  ];
}

/**
 * A JavaScript literal for `value`, safe to embed in generated source. The
 * values come from the project directory (page file names, titles, nav
 * folders). `JSON.stringify` alone leaves U+2028 and U+2029 raw, which ended a
 * string literal before ES2019, and `<` raw, which lets `</script>` close an
 * inline script if the module is ever inlined into HTML. Escaping those four
 * characters keeps the output valid JSON with the same value.
 *
 * @example
 * jsLiteral("a</script>"); // → "a\\u003c/script\\u003e", quoted
 */
function jsLiteral(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>\u2028\u2029]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function pageId(entry: PageManifestEntry): string {
  return jsLiteral(VIRTUAL_PAGE_PREFIX + entry.file);
}

/**
 * The `virtual:biac-pages` source, failing at the `biac.config.ts` key when
 * a `directories` title names a folder with no page — which fails
 * `vite build` and puts vite's overlay, linked to the key, over the dev app.
 *
 * @example
 * checkedManifestSource(root, config.directories, join(root, "biac.config.ts"));
 */
export function checkedManifestSource(
  root: string,
  directories: DirectoryTitles,
  configFile: string,
): string {
  const entries = discoverPages(root);
  try {
    checkDirectoryTitles(directories, entries);
  } catch (error) {
    if (error instanceof ConfigFieldError)
      throw locatedError(error, configFile);
    throw error;
  }
  return manifestModuleSource(entries, directories);
}

/**
 * True when a page change alters what `virtual:biac-pages` would serve. An
 * edit that breaks discovery (front-matter that no longer parses) counts as
 * unchanged: reloading would re-run discovery, fail the manifest module and
 * leave the browser with no app at all. The served manifest stays, and the
 * edited page's own module reports the error. A broken config counts as
 * unchanged too — its own reload already put the error on screen.
 *
 * @example
 * if (await manifestChanged(root, getConfig, servedManifest)) invalidate();
 */
export async function manifestChanged(
  root: string,
  getConfig: () => Promise<BiacConfig>,
  servedManifest: string | undefined,
): Promise<boolean> {
  try {
    const { directories } = await getConfig();
    return (
      manifestModuleSource(discoverPages(root), directories) !== servedManifest
    );
  } catch {
    return false;
  }
}
