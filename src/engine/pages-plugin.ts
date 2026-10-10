import { existsSync } from "node:fs";
import { cp } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { Plugin } from "vite";
import { loadBiacConfig } from "./biac-config.js";
import { compilePage } from "./compile-page.js";
import { discoverPages } from "./discover-pages.js";
import {
  manifestModuleSource,
  VIRTUAL_PAGE_PREFIX,
} from "./manifest-module.js";
import {
  compileErrorModuleSource,
  pageCompileError,
} from "./page-compile-error.js";
import { pageSourceEndpoint } from "./page-source-endpoint.js";
import { serveDataDir } from "./serve-data-dir.js";
import type { BiacConfig, SqlTableMap } from "./types.js";

const VIRTUAL_MANIFEST_ID = "virtual:biac-pages";
const RESOLVED_MANIFEST_ID = `\0${VIRTUAL_MANIFEST_ID}`;
const VIRTUAL_CONFIG_ID = "virtual:biac-config";
const RESOLVED_CONFIG_ID = `\0${VIRTUAL_CONFIG_ID}`;
const CONFIG_FILE = "biac.config.ts";

/**
 * Vite plugin that puts `pages/**\/*.{md,mdx}` inside the module graph: every
 * page compiles to an MDX module through {@link compilePage}, and
 * `virtual:biac-pages` serves the page manifest the SPA builds its routes
 * from. A page that fails to compile fails `vite build`; the dev server
 * instead serves a module carrying the error, which the SPA renders where
 * the page would be — an author mid-edit keeps the app, and the next good
 * save hot-updates like any other. Because pages are real modules,
 * edits hot-update through vite's normal HMR propagation: the manifest
 * accepts every page module, so a content edit swaps the page in place.
 * An edit that changes the manifest itself — a page added or removed, a nav
 * front-matter field edited — invalidates the manifest module, which no
 * importer accepts: propagation dead-ends into a full reload and the route
 * tree rebuilds.
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
  const dataDir = join(root, "data");
  const configFile = join(root, CONFIG_FILE);
  // Page transforms consult the config's `sql:` map; `loadBiacConfig`
  // re-bundles the file through esbuild on every call, so the resolved
  // config is memoized and dropped when the watcher reports an edit.
  let configPromise: Promise<BiacConfig> | undefined;
  const getConfig = () => (configPromise ??= loadBiacConfig(root));
  // The manifest last handed to vite — a page change that regenerates the
  // same source is content-only and must not invalidate it.
  let servedManifest: string | undefined;
  let isDevServer = false;

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
      isDevServer = config.command === "serve";
    },
    resolveId(id) {
      if (id === VIRTUAL_MANIFEST_ID) return RESOLVED_MANIFEST_ID;
      if (id === VIRTUAL_CONFIG_ID) return RESOLVED_CONFIG_ID;
      if (!id.startsWith(VIRTUAL_PAGE_PREFIX)) return;
      const file = join(root, id.slice(VIRTUAL_PAGE_PREFIX.length));
      if (!toPosix(file).startsWith(`${pagesDirPosix}/`)) return null;
      return file;
    },
    async load(id) {
      if (id === RESOLVED_CONFIG_ID) {
        return configModuleSource(await getConfig());
      }
      if (id !== RESOLVED_MANIFEST_ID) return;
      servedManifest = manifestModuleSource(discoverPages(root));
      return servedManifest;
    },
    async transform(code, id) {
      if (!isPageFile(id, pagesDirPosix)) return;
      const file = `pages/${toPosix(id).slice(pagesDirPosix.length + 1)}`;
      const { sqlTables } = await getConfig();
      const moduleSource = isDevServer
        ? await compiledOrErrorModule(code, file, sqlTables)
        : (await compilePage(code, file, sqlTables)).code;
      return { code: moduleSource, map: null };
    },
    // The inline theme script in index.html runs before any module loads,
    // so the `virtual:biac-config` default reaches it as a plain global.
    // head-prepend guarantees the value exists before that script runs;
    // without it a `theme: "dark"` project would paint one light frame on
    // every load.
    async transformIndexHtml() {
      const { theme } = await getConfig();
      return [
        {
          tag: "script",
          children: `globalThis.__BIAC_THEME__=${JSON.stringify(theme)};`,
          injectTo: "head-prepend" as const,
        },
      ];
    },
    configureServer(server) {
      // sql: sources resolve to /data/<path> — served from the real
      // directory so dev and the copied build/data/ stay identical.
      server.middlewares.use("/data", serveDataDir(dataDir));
      // The editor's write path into pages/. configureServer runs for the
      // dev server only — `vite build` and `vite preview` never mount it.
      server.middlewares.use(
        "/__biac/page-source",
        pageSourceEndpoint(pagesDir),
      );
      server.watcher.add(pagesDir);
      server.watcher.add(configFile);
      server.watcher.add(dataDir);
    },
    async writeBundle({ dir }) {
      if (dir === undefined) {
        throw new Error(
          `biac:pages needs a build output directory to copy data/ into, got output.dir=${dir} (expected a path string)`,
        );
      }
      await copyDataDir(dataDir, join(dir, "data"));
    },
    hotUpdate({ file, modules }) {
      if (file === configFile) {
        configPromise = undefined;
        const graph = this.environment.moduleGraph;
        // `sql:` collisions are checked when a page compiles — a config edit
        // can create or clear one without touching the page file, so cached
        // page transforms must re-run against the new config.
        const stalePages = [...graph.idToModuleMap.values()].filter(
          (mod) => mod.id && isPageFile(mod.id, pagesDirPosix),
        );
        const configModule = graph.getModuleById(RESOLVED_CONFIG_ID);
        for (const mod of [configModule, ...stalePages]) {
          if (mod) graph.invalidateModule(mod);
        }
        return [
          ...modules,
          ...(configModule ? [configModule] : []),
          ...stalePages,
        ];
      }
      if (!isPageFile(file, pagesDirPosix)) return;
      if (!manifestChanged(root, servedManifest)) return;
      // The manifest has no accepting importer upstream, so propagation
      // dead-ends into a full reload and the route tree rebuilds.
      const graph = this.environment.moduleGraph;
      const manifest = graph.getModuleById(RESOLVED_MANIFEST_ID);
      if (!manifest) return;
      graph.invalidateModule(manifest);
      return [...modules, manifest];
    },
  };
}

/**
 * Copies the whole `data/` tree unhashed: `sql:` sources fetch `/data/<path>`
 * in dev and in the built site alike, so page SQL never rewrites. Symlinks
 * are followed because the dev mount serves their targets too. A project
 * without `data/` copies nothing.
 */
async function copyDataDir(dataDir: string, outDataDir: string): Promise<void> {
  if (!existsSync(dataDir)) return;
  await cp(dataDir, outDataDir, { recursive: true, dereference: true });
}

/**
 * The page's compiled module, or — when it does not compile — the module
 * that carries the error to the SPA. Throwing here would make vite answer
 * the module request with a 500 and cover the whole app, the page's own
 * source editor included, with its error overlay.
 */
async function compiledOrErrorModule(
  markdown: string,
  file: string,
  configTables: SqlTableMap,
): Promise<string> {
  try {
    return (await compilePage(markdown, file, configTables)).code;
  } catch (error) {
    return compileErrorModuleSource(pageCompileError(error, file));
  }
}

function configModuleSource(config: BiacConfig): string {
  return `export const config = ${JSON.stringify(config)};\n`;
}

/**
 * True when a page change alters what `virtual:biac-pages` would serve. An
 * edit that breaks discovery (front-matter that no longer parses) counts as
 * unchanged: reloading would re-run discovery, fail the manifest module and
 * leave the browser with no app at all. The served manifest stays, and the
 * edited page's own module reports the error.
 */
function manifestChanged(
  root: string,
  servedManifest: string | undefined,
): boolean {
  try {
    return manifestModuleSource(discoverPages(root)) !== servedManifest;
  } catch {
    return false;
  }
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
