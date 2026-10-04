import { defineConfig } from "vite";
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
  plugins: [react(), tailwindcss()],
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
