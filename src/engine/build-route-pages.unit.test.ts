import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import {
  assertRoutesBuildable,
  copyShellToRoutes,
} from "./build-route-pages.js";

let projectRoot: string | undefined;

afterEach(() => {
  cleanupProjects();
  projectRoot = undefined;
});

function makeProject(): string {
  projectRoot = makeTempProject("biac-route-pages-");
  return projectRoot;
}

const SHELL = "<html><body>shell</body></html>";

/** A build output dir holding only the emitted shell, as vite leaves it. */
function makeBuildWithShell(root: string): string {
  const outDir = join(root, "build");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), SHELL);
  return outDir;
}

describe("assertRoutesBuildable", () => {
  it("passes for the root route and ordinary page routes", () => {
    const root = makeProject();
    writeProjectFile(root, "pages/index.md", "# Home\n");
    writeProjectFile(root, "pages/weekly-review.md", "# W\n");
    writeProjectFile(root, "pages/nested/allocation.md", "# A\n");

    expect(() => assertRoutesBuildable(root)).not.toThrow();
  });

  it("fails naming the page, its route and the reserved segment", () => {
    const root = makeProject();
    writeProjectFile(root, "pages/index.md", "# Home\n");
    writeProjectFile(root, "pages/data/notes.md", "# Notes\n");

    expect(() => assertRoutesBuildable(root)).toThrow(
      /Reserved route "\/data\/notes" from "pages\/data\/notes\.md" — the build output owns the first segment "data"/,
    );
  });

  it.each(["assets", "widgets", "favicon.svg", "index.html", "404.html"])(
    "fails for a page whose route starts with the emitted name %s",
    (segment) => {
      const root = makeProject();
      writeProjectFile(root, `pages/${segment}.md`, "# P\n");

      expect(() => assertRoutesBuildable(root)).toThrow(
        new RegExp(`first segment "${segment}"`),
      );
    },
  );
});

describe("copyShellToRoutes", () => {
  it("writes a byte-identical index.html per route and skips the root route", async () => {
    const root = makeProject();
    writeProjectFile(root, "pages/index.md", "# Home\n");
    writeProjectFile(root, "pages/weekly-review.md", "# W\n");
    writeProjectFile(root, "pages/nested/allocation.md", "# A\n");
    const outDir = makeBuildWithShell(root);

    await copyShellToRoutes(outDir, root);

    expect(readFileSync(join(outDir, "weekly-review/index.html"))).toEqual(
      Buffer.from(SHELL),
    );
    expect(readFileSync(join(outDir, "nested/allocation/index.html"))).toEqual(
      Buffer.from(SHELL),
    );
  });

  it("writes the 404 error document as a copy of the shell", async () => {
    const root = makeProject();
    writeProjectFile(root, "pages/index.md", "# Home\n");
    const outDir = makeBuildWithShell(root);

    await copyShellToRoutes(outDir, root);

    expect(readFileSync(join(outDir, "404.html"))).toEqual(Buffer.from(SHELL));
  });

  it("fails naming the shell when the build emitted none", async () => {
    const root = makeProject();
    writeProjectFile(root, "pages/index.md", "# Home\n");
    const outDir = join(root, "build");
    mkdirSync(outDir, { recursive: true });

    await expect(copyShellToRoutes(outDir, root)).rejects.toThrow(
      /no index\.html/,
    );
  });
});
