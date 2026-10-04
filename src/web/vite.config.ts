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
  plugins: [react(), tailwindcss(), emptyPagesFallback()],
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
 * `virtual:biac-pages` is served by the engine's `biac:pages` plugin, which
 * `biac dev` registers inline with the project dir. Bare vite invocations
 * (`pnpm dev`, `vite build`, storybook) register no pages plugin — this
 * fallback resolves the import to an empty manifest so the SPA still
 * bundles and serves, with every URL landing on the not-found page.
 */
function emptyPagesFallback(): Plugin {
  let armed = true;
  return {
    name: "biac:empty-pages-fallback",
    configResolved(config) {
      armed = !config.plugins.some((plugin) => plugin.name === "biac:pages");
    },
    resolveId(id) {
      if (armed && id === "virtual:biac-pages") return "\0biac:empty-pages";
    },
    load(id) {
      if (armed && id === "\0biac:empty-pages") {
        return "export const pages = [];\n";
      }
    },
  };
}
