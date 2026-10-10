import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // A passing run prints its summary and nothing else: `minimal` prints a
    // module or a test only once it has failed, with the default reporter's
    // full diff and stack. `--reporter=default` restores the live file tree.
    reporters: ["minimal"],
    // Half the cores, not vitest's cores-minus-one run default: jsdom
    // workers are heavy and this host runs other repos' suites alongside.
    // vitest's own VITEST_MAX_WORKERS env var overrides it.
    maxWorkers: "50%",
    coverage: {
      provider: "v8",
      // Global thresholds; `text-summary` prints the four numbers the gate is
      // judged on and `html` keeps per-file detail in coverage/ for when a
      // number needs explaining.
      reporter: ["text-summary", "html"],
      thresholds: {
        lines: 85,
        branches: 75,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          // Node-side sources only (src/cli, src/engine) — src/web is the
          // SPA's own deployment artifact (web-unit project below); without
          // this exclusion the web tests run twice with the wrong `@/` alias.
          include: ["src/**/*.unit.test.ts"],
          exclude: ["src/web/**", "node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          // Colocated web component tests (`component-name.unit.test.tsx`)
          // need a DOM — jsdom, the @testing-library default environment.
          name: "web-unit",
          environment: "jsdom",
          include: ["src/web/src/**/*.unit.test.{ts,tsx}"],
          setupFiles: ["src/web/vitest.setup.ts"],
        },
        // The web app's `@/` alias points inside src/web/src — the root
        // alias (node-side `src/`) must not leak into web tests.
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src/web/src"),
          },
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          // SPA modules checked against a real engine (duckdb-wasm's node
          // bindings) colocate with the code they cover.
          include: [
            "test/integration/**/*.integration.test.ts",
            "src/web/src/**/*.integration.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          environment: "node",
          // E2e suites boot a real `biac serve`; serial files keep those
          // process storms sequential.
          fileParallelism: false,
          include: ["test/e2e/**/*.e2e.test.ts"],
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
