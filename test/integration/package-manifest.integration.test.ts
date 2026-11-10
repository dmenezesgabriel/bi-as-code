import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { buildCli } from "../lib/dev-server.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Measured 2026-11-09 at 330,381 B packed; the budget leaves room for a widget, not for a re-added `dist/web` (102 MB). */
const MAX_PACKED_BYTES = 500_000;
const MAX_UNPACKED_BYTES = 1_650_000;

/** Packages the CLI, the page pipeline and the SPA's Vite config import at run time. */
const RUNTIME_PACKAGES = [
  "@mdx-js/mdx",
  "@tailwindcss/vite",
  "@vitejs/plugin-react",
  "i18next",
  "mdast-util-mdx-jsx",
  "mdast-util-to-string",
  "react",
  "react-dom",
  "remark-gfm",
  "tailwindcss",
  "unified",
  "unist-util-visit",
  "vfile",
  "vfile-matter",
  "vite",
  "yaml",
];

interface PackResult {
  size: number;
  unpackedSize: number;
  files: { path: string }[];
}

interface Manifest {
  name: string;
  private?: boolean;
  bin?: Record<string, string>;
  publishConfig?: { access?: string };
  description?: string;
  keywords?: string[];
  homepage?: string;
  bugs?: { url?: string };
  author?: string;
  repository?: unknown;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
}

function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
}

/**
 * What `npm publish` would upload. `prepack` would compile `dist/` first, but
 * its banner lands on stdout ahead of the JSON, so the test builds the CLI
 * itself and packs with scripts off.
 */
function dryRunPack(): PackResult {
  buildCli();
  const run = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- the pack listing is what `npm publish` uploads, so it must come from whichever `npm` the caller has on PATH
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (run.status !== 0) {
    throw new Error(`npm pack --dry-run failed (${run.status}): ${run.stderr}`);
  }
  return (JSON.parse(run.stdout) as PackResult[])[0]!;
}

describe("the published package", () => {
  let packed: PackResult;
  let packedPaths: string[];

  beforeAll(() => {
    packed = dryRunPack();
    packedPaths = packed.files.map((file) => file.path);
  }, 120_000);

  // The registry refused the unscoped name `biac` as too similar to existing
  // packages, so the package lives under the `@biac` scope; the command it
  // installs is still `biac` (the `bin` map below).
  it("is named @biac/cli and is not private", () => {
    // Arrange
    const manifest = readManifest();

    // Assert
    expect(manifest.name).toBe("@biac/cli");
    expect(manifest.private).toBeUndefined();
    expect(manifest.repository).toBeDefined();
  });

  it("installs the biac command", () => {
    expect(readManifest().bin).toEqual({ biac: "bin/biac" });
  });

  // A scoped package is restricted by default; without this, `npm publish`
  // from the release workflow fails with a 402.
  it("publishes publicly", () => {
    expect(readManifest().publishConfig).toEqual({ access: "public" });
  });

  it("compiles the CLI before every pack", () => {
    expect(readManifest().scripts["prepack"]).toBe("pnpm build:cli");
  });

  it("declares every package the CLI and the SPA config import as a dependency", () => {
    // Arrange
    const declared = Object.keys(readManifest().dependencies);

    // Assert
    expect(declared).toEqual(expect.arrayContaining(RUNTIME_PACKAGES));
  });

  it("describes itself for the npm page", () => {
    // Arrange
    const manifest = readManifest();

    // Assert
    expect(manifest.description).toMatch(/\S/);
    expect(manifest.keywords?.length).toBeGreaterThan(0);
    expect(manifest.homepage).toMatch(/^https:\/\//);
    expect(manifest.bugs?.url).toMatch(/^https:\/\//);
    expect(manifest.author).toMatch(/\S/);
  });

  // NOTICE carries the attribution the ported code's licenses and Apache-2.0
  // section 4(d) require to travel with every copy; npm adds README and
  // LICENSE on its own but not NOTICE.
  it.each([
    "README.md",
    "LICENSE",
    "NOTICE",
    "bin/biac",
    "dist/cli/main.js",
    "dist/engine/pages-plugin.js",
    "src/web/vite.config.ts",
    "src/web/vite-plugins/chart-source-fixes.ts",
    "src/web/index.html",
  ])("ships %s", (path) => {
    expect(packedPaths).toContain(path);
  });

  it.each([
    /^dist\/web\//,
    /^dist\/storybook\//,
    /^test\//,
    /^maintainer\//,
    /^data\//,
    /^src\/web\/\.storybook\//,
    /^src\/web\/package\.json$/,
    /\.stories\.tsx$/,
    /\.test\.tsx?$/,
    /\.fixture\.tsx?$/,
    /\.mdx$/,
  ])("leaves out %s", (pattern) => {
    expect(packedPaths.filter((path) => pattern.test(path))).toEqual([]);
  });

  it("stays inside the size budget", () => {
    expect(packed.size).toBeLessThanOrEqual(MAX_PACKED_BYTES);
    expect(packed.unpackedSize).toBeLessThanOrEqual(MAX_UNPACKED_BYTES);
  });
});
