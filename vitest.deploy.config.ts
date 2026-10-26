import { defineConfig } from "vitest/config";

// The deploy examples under examples/ checked in real containers. A config
// of its own, not a project in vitest.config.ts, so `pnpm gate`'s bare
// `vitest run` never needs Docker or image pulls; run it with
// `pnpm test:deploy`.
export default defineConfig({
  test: {
    reporters: ["minimal"],
    environment: "node",
    include: ["test/deploy/**/*.deploy.test.ts"],
    // Each file brings a whole compose stack up; one at a time.
    fileParallelism: false,
    // Cold image pulls and a provider download dominate the first run.
    hookTimeout: 600_000,
    testTimeout: 30_000,
  },
});
