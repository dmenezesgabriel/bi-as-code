import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { build as viteBuild } from "vite";
import { loadBiacConfig } from "../../engine/biac-config.js";
import { pagesPlugin } from "../../engine/pages-plugin.js";
import {
  widgetEntrySource,
  widgetExports,
  type ExportedWidgetModule,
} from "../../engine/widget-exports.js";
import { resolveProjectRoot, WEB_CONFIG } from "./web-project.js";

export interface BuildOptions {
  /** Directory containing `pages/`; defaults to the current directory. */
  projectRoot: string;
}

export function parseBuildArgs(args: string[]): BuildOptions {
  const { positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {},
  });
  return { projectRoot: resolveProjectRoot("build", positionals) };
}

/**
 * Bundles `projectRoot`'s pages into a static SPA under `<projectRoot>/build`,
 * emptied first so a removed page never lingers in the output. Every manifest
 * route gets its own byte-identical copy of the shell at
 * `build/<route>/index.html` (plus `build/404.html`), so a static host with
 * no rewrite rule answers every deep link. Pages that carry `export="name"`
 * widget tags also get one self-contained ES module each under
 * `build/widgets/` — a library-mode build of the web mount entry with the
 * widget's spec baked, for a host page on another origin to import.
 *
 * @example
 * // in main.ts: case "build": await build(["site"]);
 */
export async function build(args: string[]): Promise<void> {
  const { projectRoot } = parseBuildArgs(args);
  const outDir = join(projectRoot, "build");
  // The SPA build compiles every page first: a page that fails — an invalid
  // export included, the sweep runs in every compile — fails here, where
  // vite's build error names the page. The export sweep runs after, on
  // pages that already compiled clean, so its own errors (a name declared
  // by two pages) are the only ones it can raise.
  // `base` is deploy config the pages plugin never reads: vite prepends it
  // to every asset URL in index.html and bakes it as
  // import.meta.env.BASE_URL. `biac dev` stays at "/" — the prefix only
  // exists on a static host.
  const { base } = await loadBiacConfig(projectRoot);
  await viteBuild({
    configFile: WEB_CONFIG,
    base,
    plugins: [pagesPlugin(projectRoot)],
    build: { outDir, emptyOutDir: true },
  });
  const modules = await widgetExports(projectRoot);
  if (modules.length > 0) await buildWidgetModules(modules, outDir);
  console.log(`biac build — wrote ${outDir}`);
  for (const module of modules) {
    const file = join(outDir, "widgets", `${module.name}.js`);
    console.log(`Widget module: ${file}`);
  }
}

/**
 * The library-mode build emitting one module per export beside the SPA.
 * `emptyOutDir: false` keeps the SPA's output; the duckdb wasm and worker
 * assets re-emit into `build/assets/` under their content hash — the SPA's
 * own copies, byte-identical, not a second 33 MB. `base: ""` is vite's
 * relative-base build: every asset URL in the module becomes
 * `new URL("<relative-to-the-module>", import.meta.url).href`, so it resolves
 * against the publishing origin (wherever the module is served from), never
 * the host page's.
 *
 * The baked entries are real temp files, not virtual modules: rolldown
 * resolves lib entries against the root before plugins see them, so a
 * `virtual:` entry id never reaches a plugin's resolveId (measured on
 * vite 8.2.2 — the entry failed UNRESOLVED_ENTRY with the root prepended).
 */
async function buildWidgetModules(
  modules: readonly ExportedWidgetModule[],
  outDir: string,
): Promise<void> {
  const webDir = dirname(WEB_CONFIG);
  const entriesDir = mkdtempSync(join(tmpdir(), "biac-widget-entries-"));
  try {
    const entry = Object.fromEntries(
      modules.map((module) => {
        const source = widgetEntrySource(module, {
          mountWidget: join(
            webDir,
            "src/features/widget-module/mount-widget.tsx",
          ),
          moduleRuntime: join(
            webDir,
            "src/features/widget-module/module-runtime.ts",
          ),
        });
        const file = join(entriesDir, `${module.name}.js`);
        writeFileSync(file, source);
        return [module.name, file];
      }),
    );
    await viteBuild({
      configFile: WEB_CONFIG,
      base: "",
      // vite's definePlugin skips the process.env defines in a lib build
      // (a library's consumer is supposed to supply them) — this module
      // ships to browsers where `process` does not exist, so the SPA
      // build's own replacements are mirrored here: react-dom's interop
      // reads process.env.NODE_ENV at module scope and would crash on
      // import otherwise. Production unconditionally: the module is a
      // build artifact, and inheriting the environment's NODE_ENV would
      // bake react's development build whenever the CLI runs under a test
      // runner.
      define: {
        "process.env.NODE_ENV": '"production"',
        "global.process.env.NODE_ENV": '"production"',
        "globalThis.process.env.NODE_ENV": '"production"',
        "process.env": "{}",
        "global.process.env": "{}",
        "globalThis.process.env": "{}",
      },
      build: {
        outDir,
        emptyOutDir: false,
        assetsDir: "assets",
        lib: { entry, formats: ["es"] },
        rollupOptions: {
          output: {
            entryFileNames: "widgets/[name].js",
            chunkFileNames: "widgets/[name]-[hash].js",
          },
        },
      },
    });
  } finally {
    rmSync(entriesDir, { recursive: true, force: true });
  }
}
