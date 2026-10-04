import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Vite resolves a relative root against process.cwd(), not this file's
  // directory — with `pnpm dev` run from the repo root that made the whole
  // repo (untracked foreign checkouts included) the app root. Pin the root
  // to the SPA dir.
  root: __dirname,
  plugins: [react(), tailwindcss(), emptyProjectFallback()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
 * `virtual:biac-pages` and `virtual:biac-config` are served by the engine's
 * `biac:pages` plugin, which `biac dev` registers inline with the project
 * dir. Bare vite invocations (`pnpm dev`, `vite build`, storybook) register
 * no pages plugin — this fallback resolves both imports to defaults (empty
 * manifest, stock config) so the SPA still bundles and serves, with every
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
    },
    load(id) {
      if (!armed) return;
      if (id === "\0biac:empty-pages") return "export const pages = [];\n";
      if (id === "\0biac:empty-config") {
        return 'export const config = {"title":"biac","theme":"system","nav":{"sidebar":true}};\n';
      }
    },
  };
}
