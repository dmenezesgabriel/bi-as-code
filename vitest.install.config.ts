import { defineConfig } from "vitest/config";

// The packed tarball installed with real npm and pnpm. A config of its own,
// not a project in vitest.config.ts, so `pnpm gate`'s bare `vitest run` never
// depends on the package registry: a registry outage must not turn the
// required gate check red. The install CI job runs it with `pnpm test:install`.
export default defineConfig({
  test: {
    reporters: ["minimal"],
    environment: "node",
    include: ["test/install/**/*.install.test.ts"],
    // Each case installs hundreds of MB into its own directory; one at a time.
    fileParallelism: false,
    // The packing and the CLI build run before the first case.
    hookTimeout: 180_000,
    testTimeout: 300_000,
  },
});
