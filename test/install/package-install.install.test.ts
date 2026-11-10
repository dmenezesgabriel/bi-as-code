import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCli, startBiacServer } from "../lib/dev-server.js";
import {
  installTarball,
  makeDiskProject,
  packTarball,
  type PackageManager,
} from "../lib/install-project.js";
import { cleanupProjects, writeProjectFile } from "../lib/temp-project.js";

/** Classes `src/web/src/App.tsx` uses that Tailwind only emits when it scans the installed `node_modules/biac/src/web`. */
const SHIPPING_CLASSES = [
  ".w-72{",
  ".sticky{",
  ".border-b{",
  ".bg-sidebar{",
  ".border-border{",
  ".inset-y-0{",
  ".z-40{",
];
/** A line of zrender's `Painter.js` that only the chart-library fix writes; the unpatched library lacks it. */
const ZRENDER_FIX_MARKER = "_redrawId=null";
const MANAGERS: PackageManager[] = ["npm", "pnpm"];

let tarball: string;

beforeAll(() => {
  // `bin/biac` runs dist/cli, and the tarball ships dist/cli and dist/engine.
  buildCli();
  tarball = packTarball(makeDiskProject("biac-pack-"));
}, 180_000);

afterAll(() => {
  cleanupProjects();
});

function installedProject(manager: PackageManager): {
  root: string;
  biac: string;
} {
  const root = makeDiskProject(`biac-install-${manager}-`);
  installTarball(manager, root, tarball);
  writeProjectFile(root, "site/pages/index.md", "# Hello\n");
  return { root, biac: join(root, "node_modules/@biac/cli/bin/biac") };
}

function builtAssets(root: string, extension: string): string[] {
  const assets = join(root, "site/build/assets");
  return readdirSync(assets)
    .filter((name) => name.endsWith(extension))
    .map((name) => readFileSync(join(assets, name), "utf8"));
}

describe.each(MANAGERS)(
  "a project that installs the tarball with %s",
  (manager) => {
    it("builds with the chart fixes and the SPA's styles", () => {
      // Arrange
      const { root, biac } = installedProject(manager);

      // Act: execFileSync throws on a non-zero exit, so returning is the exit-0 check.
      execFileSync(process.execPath, [biac, "build", join(root, "site")]);

      // Assert
      expect(existsSync(join(root, "site/build/index.html"))).toBe(true);
      const css = builtAssets(root, ".css").join("\n");
      for (const shippingClass of SHIPPING_CLASSES) {
        expect(css, shippingClass).toContain(shippingClass);
      }
      const bundlesWithFix = builtAssets(root, ".js").filter((source) =>
        source.includes(ZRENDER_FIX_MARKER),
      );
      expect(bundlesWithFix).toHaveLength(1);
    }, 300_000);

    it("serves the app from `biac dev`", async () => {
      // Arrange
      const { root, biac } = installedProject(manager);
      const server = await startBiacServer(
        "dev",
        join(root, "site"),
        {},
        [],
        biac,
      );

      // Act
      const response = await fetch(server.url);
      await server.stop();

      // Assert
      expect(response.status).toBe(200);
    }, 300_000);
  },
);
