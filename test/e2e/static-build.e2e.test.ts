import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCli } from "../lib/dev-server.js";
import { copyShippedProject } from "../lib/shipped-project.js";
import { cleanupProjects, makeTempProject } from "../lib/temp-project.js";

const biac = fileURLToPath(new URL("../../bin/biac", import.meta.url));

beforeAll(() => {
  // The e2e exercises the shipped artifact: bin/biac runs dist/cli, never src.
  buildCli();
}, 120_000);

afterAll(() => {
  cleanupProjects();
});

describe("biac build", () => {
  it("builds the shipped project into <project>/build and names it", () => {
    const root = makeTempProject("biac-e2e-build-");
    copyShippedProject(root);

    // execFileSync throws on a non-zero exit, so returning is the exit-0 check.
    const stdout = execFileSync(process.execPath, [biac, "build", root], {
      encoding: "utf8",
    });

    expect(stdout).toContain(`wrote ${join(root, "build")}`);
    expect(existsSync(join(root, "build", "index.html"))).toBe(true);
  }, 120_000);
});
