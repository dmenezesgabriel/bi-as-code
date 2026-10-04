import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Stryker runs the unit project only — integration/e2e boot real processes a
// sandboxed mutant cannot observe.
export default defineConfig({
  test: {
    reporters: ["minimal"],
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.unit.test.ts"],
          exclude: ["src/web/**", "node_modules/**"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
