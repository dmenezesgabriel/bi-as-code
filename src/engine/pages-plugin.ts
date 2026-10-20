import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type {
  DevEnvironment,
  EnvironmentModuleNode,
  HtmlTagDescriptor,
  Logger,
  NormalizedHotChannel,
  Plugin,
} from "vite";
import { ConfigFieldError, locatedError } from "./biac-config-error.js";
import { loadBiacConfig } from "./biac-config.js";
import { brandCss } from "./brand-css.js";
import { compilePage } from "./compile-page.js";
import { diskQueryFiles } from "./disk-query-files.js";
import { DATA_UPDATE_EVENT, dataUpdateFor } from "./data-update.js";
import {
  copyDataDir,
  copyLoaderOutputs,
  runDataLoaders,
} from "./build-data-dir.js";
import { createDataLoaderCache, type DataLoaderLog } from "./data-loader.js";
import { checkDirectoryTitles } from "./directory-titles.js";
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
import { queryFilesRead } from "./query-files.js";
import { loadProjectTranslations } from "./resolve-translations.js";
import { serveDataDir } from "./serve-data-dir.js";
import { TRANSLATIONS_FILE } from "./translations-file.js";
import {
  translationsModuleSource,
  VIRTUAL_TRANSLATIONS_ID,
} from "./translations-module.js";
import type {
  BiacConfig,
  CompiledPage,
  DirectoryTitles,
  ResolvedTranslations,
} from "./types.js";

const VIRTUAL_MANIFEST_ID = "virtual:biac-pages";
const RESOLVED_MANIFEST_ID = `\0${VIRTUAL_MANIFEST_ID}`;
const VIRTUAL_CONFIG_ID = "virtual:biac-config";
const RESOLVED_CONFIG_ID = `\0${VIRTUAL_CONFIG_ID}`;
const RESOLVED_TRANSLATIONS_ID = `\0${VIRTUAL_TRANSLATIONS_ID}`;
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
  const queryFiles = diskQueryFiles(root);
  const translationsFile = join(root, TRANSLATIONS_FILE);
  // Resolving runs i18next over every language, so — like the config — the
  // result is memoized and dropped when the watcher reports an edit.
  let translationsPromise: Promise<ResolvedTranslations> | undefined;
  const getTranslations = () =>
    (translationsPromise ??= loadProjectTranslations(root));
  // Page transforms consult the config's `sql:` map; `loadBiacConfig`
  // re-bundles the file through esbuild on every call, so the resolved
  // config is memoized and dropped when the watcher reports an edit.
  let configPromise: Promise<BiacConfig> | undefined;
  const getConfig = () => (configPromise ??= loadBiacConfig(root));
  // A config edit changes index.html and every route, so the page reloads
  // in full — sent here rather than left to vite's propagation, which stops
  // without a reload at a module it never analyzed: the config module after
  // a failed load, so fixing a typo would leave the error on screen.
  // Creating or deleting translations.yaml reloads the same way: it changes
  // which `$translations` keys exist for every page, and a page watches the
  // file only while it exists.
  const reloadAfterProjectFileEdit = (
    environment: DevEnvironment,
    file: string,
  ) => {
    configPromise = undefined;
    translationsPromise = undefined;
    const graph = environment.moduleGraph;
    // `sql:` collisions and a page brand's contrast against the project
    // brand are checked when a page compiles — a config edit can create or
    // clear either without touching the page file, so cached page
    // transforms must re-run against the new config.
    const stalePages = [...graph.idToModuleMap.values()].filter(
      (mod) => mod.id && isPageFile(mod.id, pagesDirPosix),
    );
    const configModule = graph.getModuleById(RESOLVED_CONFIG_ID);
    // `directories` titles live in the manifest's nav tree.
    const manifest = graph.getModuleById(RESOLVED_MANIFEST_ID);
    for (const mod of [configModule, manifest, ...stalePages]) {
      if (mod) graph.invalidateModule(mod);
    }
    if (environment.name !== "client") return;
    environment.logger.info(`page reload ${file}`, { timestamp: true });
    environment.hot.send({ type: "full-reload" });
  };
  // The pages that read the file watch it, so vite re-transforms them; the
  // translations module is not a file, so it is invalidated here and goes
  // out with them — each page's re-import then fetches its new text.
  const hotUpdateTranslations = (
    environment: DevEnvironment,
    modules: EnvironmentModuleNode[],
  ): EnvironmentModuleNode[] => {
    translationsPromise = undefined;
    const graph = environment.moduleGraph;
    const translationsModule = graph.getModuleById(RESOLVED_TRANSLATIONS_ID);
    if (!translationsModule) return modules;
    graph.invalidateModule(translationsModule);
    return [...modules, translationsModule];
  };
  // The manifest last handed to vite — a page change that regenerates the
  // same source is content-only and must not invalidate it.
  let servedManifest: string | undefined;
  let isDevServer = false;
  // Watched data/ file → the mtime last pushed for it, so chokidar's
  // repeated events for one write push a single update.
  const sentDataVersions = new Map<string, number>();
  // Vite has one HMR channel, not one per page: every open page gets the
  // update and drops paths its queries do not read.
  const pushDataUpdate = async (
    hot: NormalizedHotChannel,
    file: string,
  ): Promise<boolean> => {
    const update = dataUpdateFor(
      file,
      dataDir,
      sentDataVersions.get(file),
      (await getConfig()).interpreters,
    );
    if (!update) return false;
    sentDataVersions.set(file, update.version);
    hot.send(DATA_UPDATE_EVENT, update);
    return true;
  };
  // Build only: each loader target → its up-to-date output in the cache.
  let loaderOutputs: Map<string, string> = new Map();

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
    // Loaders run before bundling, so a broken one fails the build in the
    // time it takes to run, and leaves no half-written build/ behind.
    async buildStart() {
      if (isDevServer) return;
      loaderOutputs = await runDataLoaders(
        root,
        viteLoaderLog(this.environment.logger),
        (await getConfig()).interpreters,
      );
    },
    resolveId(id) {
      if (id === VIRTUAL_MANIFEST_ID) return RESOLVED_MANIFEST_ID;
      if (id === VIRTUAL_CONFIG_ID) return RESOLVED_CONFIG_ID;
      if (id === VIRTUAL_TRANSLATIONS_ID) return RESOLVED_TRANSLATIONS_ID;
      if (!id.startsWith(VIRTUAL_PAGE_PREFIX)) return;
      const file = join(root, id.slice(VIRTUAL_PAGE_PREFIX.length));
      if (!toPosix(file).startsWith(`${pagesDirPosix}/`)) return null;
      return file;
    },
    async load(id) {
      if (id === RESOLVED_CONFIG_ID) {
        return configModuleSource(await getConfig());
      }
      if (id === RESOLVED_TRANSLATIONS_ID) {
        return translationsModuleSource(await getTranslations());
      }
      if (id !== RESOLVED_MANIFEST_ID) return;
      servedManifest = checkedManifestSource(
        root,
        (await getConfig()).directories,
        configFile,
      );
      return servedManifest;
    },
    async transform(code, id) {
      if (!isPageFile(id, pagesDirPosix)) return;
      const file = `pages/${toPosix(id).slice(pagesDirPosix.length + 1)}`;
      const { sqlTables, brand } = await getConfig();
      const compile = () =>
        compilePage(code, file, sqlTables, brand, queryFiles, getTranslations);
      const compiled = isDevServer
        ? await compiledOrErrorModule(compile, file)
        : await compile();
      // The page module inlines each query file's SQL rather than importing
      // it, so vite learns of the file here: an edit to it re-transforms
      // every page that read it and swaps them in place like a page edit.
      for (const queryFile of queryFilesRead(compiled.sqlBlocks)) {
        this.addWatchFile(join(root, queryFile));
      }
      // Vite resolves a watched file as an import, so a missing one would
      // fail the page; its creation reloads every page instead.
      if (compiled.readsTranslations && existsSync(translationsFile))
        this.addWatchFile(translationsFile);
      return { code: compiled.code, map: null };
    },
    // The inline theme script in index.html runs before any module loads,
    // so the `virtual:biac-config` default reaches it as a plain global.
    // head-prepend guarantees the value exists before that script runs;
    // without it a `theme: "dark"` project would paint one light frame on
    // every load.
    async transformIndexHtml() {
      const { theme, brand } = await getConfig();
      return [
        {
          tag: "script",
          children: `globalThis.__BIAC_THEME__=${JSON.stringify(theme)};`,
          injectTo: "head-prepend" as const,
        },
        ...brandStyleTags(brandCss(brand)),
      ];
    },
    configureServer(server) {
      // sql: sources resolve to /data/<path> — served from the real
      // directory so dev and the copied build/data/ stay identical.
      server.middlewares.use(
        "/data",
        serveDataDir(
          dataDir,
          createDataLoaderCache(root, viteLoaderLog(server.config.logger)),
          async () => (await getConfig()).interpreters,
        ),
      );
      // The editor's write path into pages/. configureServer runs for the
      // dev server only — `vite build` and `vite preview` never mount it.
      server.middlewares.use(
        "/__biac/page-source",
        pageSourceEndpoint(pagesDir),
      );
      // Watched even with no page reading it: the memo must drop on an edit
      // so the next page to name a key checks it against the new file. Added
      // ahead of pages/: measured on vite 8.2.2, once a sibling directory is
      // watched, a root file that does not exist yet is never reported when
      // it is created.
      server.watcher.add(translationsFile);
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
      const { interpreters } = await getConfig();
      await copyDataDir(dataDir, join(dir, "data"), interpreters);
      await copyLoaderOutputs(loaderOutputs, join(dir, "data"));
    },
    async hotUpdate({ file, modules, type }) {
      // Ahead of the data push, which awaits the config: after a failed
      // load that memo is a rejection, and awaiting it would throw before
      // the edit that fixes it could drop it.
      if (file === configFile) {
        reloadAfterProjectFileEdit(this.environment, configFile);
        return [];
      }
      if (file === translationsFile && type !== "update") {
        reloadAfterProjectFileEdit(this.environment, translationsFile);
        return [];
      }
      if (file === translationsFile) {
        return hotUpdateTranslations(this.environment, modules);
      }
      // No module changed, so none is handed back to vite. Only the client
      // environment pushes: vite runs this hook once per environment.
      const isClient = this.environment.name === "client";
      if (isClient && (await pushDataUpdate(this.environment.hot, file)))
        return [];
      if (!isPageFile(file, pagesDirPosix)) return;
      if (!(await manifestChanged(root, getConfig, servedManifest))) return;
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
 * The page's compiled module, or — when it does not compile — the module
 * that carries the error to the SPA. Throwing here would make vite answer
 * the module request with a 500 and cover the whole app, the page's own
 * source editor included, with its error overlay.
 */
async function compiledOrErrorModule(
  compile: () => Promise<CompiledPage>,
  file: string,
): Promise<Pick<CompiledPage, "code" | "sqlBlocks" | "readsTranslations">> {
  try {
    return await compile();
  } catch (error) {
    // A page that fails to compile carries no blocks, so it reads no query
    // file. It may have failed on translations.yaml, so it counts as reading
    // that: it watches the file, and fixing the file recovers the page.
    return {
      code: compileErrorModuleSource(pageCompileError(error, file)),
      sqlBlocks: [],
      readsTranslations: true,
    };
  }
}

/**
 * The browser's `virtual:biac-config`. Interpreters stay behind: they
 * hold host paths (`process.execPath`) and the module ships in the build.
 */
function configModuleSource(config: BiacConfig): string {
  // `directories` reaches the browser already applied, in the manifest's
  // `navTree`; `brand` as the index.html style `brandStyleTags` injects.
  const browserConfig: Omit<
    BiacConfig,
    "interpreters" | "directories" | "brand"
  > = {
    title: config.title,
    theme: config.theme,
    nav: config.nav,
    sqlTables: config.sqlTables,
    layout: config.layout,
  };
  return `export const config = ${JSON.stringify(browserConfig)};\n`;
}

/**
 * The brand stylesheet as index.html's first `<body>` element, none when
 * empty. It must follow every theme stylesheet to win at their equal
 * specificity: in dev vite appends `styles.css` to `<head>` as a `<style>`
 * when `main.tsx` runs, after anything injected into `<head>`. Inline and
 * ahead of the app root, it still applies before first paint.
 */
function brandStyleTags(css: string): HtmlTagDescriptor[] {
  if (css === "") return [];
  return [{ tag: "style", children: css, injectTo: "body-prepend" }];
}

/**
 * The `virtual:biac-pages` source, failing at the `biac.config.ts` key when
 * a `directories` title names a folder with no page — which fails
 * `vite build` and puts vite's overlay, linked to the key, over the dev app.
 */
function checkedManifestSource(
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
 */
async function manifestChanged(
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

/**
 * Loader runs in the dev terminal and the build output: run lines through
 * vite's logger so they carry its timestamps, the loader's own stderr
 * verbatim — the same stream a loader run by hand would write to.
 */
function viteLoaderLog(logger: Logger): DataLoaderLog {
  return {
    info: (line) => logger.info(line, { timestamp: true }),
    error: (line) => logger.error(line, { timestamp: true }),
    stderr: (chunk) => process.stderr.write(chunk),
  };
}
