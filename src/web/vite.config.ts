import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chartSourceFixes } from "./vite-plugins/chart-source-fixes.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Vite resolves a relative root against process.cwd(), not this file's
  // directory — with `pnpm dev` run from the repo root that made the whole
  // repo (untracked foreign checkouts included) the app root. Pin the root
  // to the SPA dir.
  root: __dirname,
  plugins: [chartSourceFixes(), react(), tailwindcss(), emptyProjectFallback()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // The page editor and the site-search index are reached only through a
  // lazy `import()`, which the startup crawl may never have followed when
  // the dep cache was written. Vite keys that cache on the lockfile and this
  // config alone, so a source-only change never invalidates it: their deps
  // are then discovered on first `?edit` or first search, re-optimized at
  // runtime, and the page can
  // full-reload or fail the lazy import ("Failed to fetch dynamically
  // imported module"). Listing them here puts them in the config hash, so
  // they are pre-bundled at every start
  // (https://vite.dev/guide/dep-pre-bundling).
  // `features/editor/lazy-editor-deps.unit.test.ts` fails when the editor
  // imports a bare specifier missing from this list.
  optimizeDeps: {
    // The dev pre-bundle reads echarts and zrender without going through
    // `plugins`, so the chart-library fixes are registered here as well.
    rolldownOptions: { plugins: [chartSourceFixes()] },
    include: [
      "react",
      "@tanstack/react-router",
      "codemirror",
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/theme-one-dark",
      "@codemirror/lang-html",
      "@codemirror/lang-markdown",
      "@codemirror/lang-sql",
      "minisearch",
    ],
  },
  server: {
    port: 5175,
    strictPort: true,
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
  },
});

/**
 * `virtual:biac-pages`, `virtual:biac-config`, `virtual:biac-search` and
 * `virtual:biac-languages` are served by the engine's
 * `biac:pages` plugin, which `biac dev` registers inline with the project
 * dir. Bare vite invocations (`pnpm dev`, `vite build`, storybook) register
 * no pages plugin — this fallback resolves them to defaults (empty
 * manifest, stock config, no search documents, no languages) so the SPA still bundles and serves, with every
 * URL landing on the not-found page.
 */
function emptyProjectFallback(): Plugin {
  let armed = true;
  return {
    name: "biac:empty-project-fallback",
    configResolved(config) {
      armed = !config.plugins.some((plugin) => plugin.name === "biac:pages");
    },
    resolveId(id) {
      if (!armed) return;
      if (id === "virtual:biac-pages") return "\0biac:empty-pages";
      if (id === "virtual:biac-config") return "\0biac:empty-config";
      if (id === "virtual:biac-search") return "\0biac:empty-search";
      if (id === "virtual:biac-languages") return "\0biac:empty-languages";
    },
    load(id) {
      if (!armed) return;
      if (id === "\0biac:empty-pages") {
        return 'export const pages = [];\nexport const navTree = {"rootPages":[],"directories":[]};\nexport function subscribePageUpdates() {\n  return () => {};\n}\n';
      }
      if (id === "\0biac:empty-config") {
        return 'export const config = {"title":"biac","theme":"system","nav":{"sidebar":true},"sqlTables":{},"layout":{"page_width":"article","cards":false,"table_of_contents":true,"table_of_contents_label":"On this page"},"embed":{"origins":[]}};\n';
      }
      if (id === "\0biac:empty-search") return "export const documents = [];\n";
      // One array for every call: the language menu reads it as an
      // external store, which re-renders forever on a fresh `[]` each time.
      if (id === "\0biac:empty-languages") {
        return "const languages = [];\nexport function getLanguages() {\n  return languages;\n}\nexport function subscribeLanguages() {\n  return () => {};\n}\n";
      }
    },
  };
}
