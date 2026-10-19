import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildCli,
  buildProject,
  startBiacServer,
  type DevServer,
} from "../lib/dev-server.js";
import { copyShippedProject } from "../lib/shipped-project.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

const biac = fileURLToPath(new URL("../../bin/biac", import.meta.url));
const LOADER_OUTPUT = "id,amount\n1,10\n";
const LOADER = `process.stdout.write(${JSON.stringify(LOADER_OUTPUT)});\n`;

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

  it("exits 1 naming a failing data loader and its exit code", () => {
    const root = makeTempProject("biac-e2e-build-broken-");
    writeProjectFile(root, "pages/index.md", "# Broken loader\n");
    writeProjectFile(root, "data/broken.csv.js", "process.exit(3);\n");

    const run = spawnSync(process.execPath, [biac, "build", root], {
      encoding: "utf8",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("data/broken.csv.js exited with code 3");
  }, 120_000);

  it("exits 1 naming a directories title whose folder holds no page", () => {
    const root = makeTempProject("biac-e2e-build-stale-folder-");
    writeProjectFile(root, "pages/nested/page.md", "# Nested\n");
    writeProjectFile(
      root,
      "biac.config.ts",
      'export default {\n  directories: { "pages/nestd": { title: "Planning" } },\n};\n',
    );

    const run = spawnSync(process.execPath, [biac, "build", root], {
      encoding: "utf8",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      "Invalid biac.config.ts:2:18 — directories.pages/nestd: unknown key, expected one of pages/nested (did you mean pages/nested?)",
    );
  }, 120_000);

  it("writes the brand colours, palette and scale into build/index.html", () => {
    const root = makeTempProject("biac-e2e-build-brand-");
    writeProjectFile(root, "pages/index.md", "# Branded\n");
    writeProjectFile(
      root,
      "biac.config.ts",
      'export default { brand: { colors: { primary: { light: "#154886", dark: "#60a5fa" } }, palette: { light: ["#1e40af"] }, scale: { dark: ["#60a5fa"] } } };\n',
    );

    execFileSync(process.execPath, [biac, "build", root], { encoding: "utf8" });

    const html = readFileSync(join(root, "build", "index.html"), "utf8");
    expect(html).toContain("--primary: #154886;");
    expect(html).toContain("--primary: #60a5fa;");
    expect(html).toContain("--chart-1: #1e40af;");
    expect(html).toContain("--chart-scale: #60a5fa;");
  }, 120_000);

  it("exits 1 naming a brand colour under its contrast floor", () => {
    const root = makeTempProject("biac-e2e-build-brand-contrast-");
    writeProjectFile(root, "pages/index.md", "# Branded\n");
    writeProjectFile(
      root,
      "biac.config.ts",
      'export default {\n  brand: { colors: { background: { light: "#fdf6e3", dark: "#0a0a0a" } } },\n};\n',
    );

    const run = spawnSync(process.execPath, [biac, "build", root], {
      encoding: "utf8",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      "Invalid biac.config.ts:2:36 — brand.colors.background.light: #fdf6e3 against --chart-4 #cc79a7 measures 2.83:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light",
    );
  }, 120_000);

  it("exits 1 naming a palette colour under its contrast floor", () => {
    const root = makeTempProject("biac-e2e-build-brand-palette-");
    writeProjectFile(root, "pages/index.md", "# Branded\n");
    writeProjectFile(
      root,
      "biac.config.ts",
      'export default {\n  brand: { palette: { light: ["#45a1bf"] } },\n};\n',
    );

    const run = spawnSync(process.execPath, [biac, "build", root], {
      encoding: "utf8",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      "Invalid biac.config.ts:2:31 — brand.palette.light[0]: #45a1bf against --background #ffffff measures 2.95:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.palette.light[0]",
    );
  }, 120_000);
});

describe("biac preview", () => {
  let root: string;
  let server: DevServer | undefined;

  beforeAll(() => {
    root = makeTempProject("biac-e2e-preview-");
    copyShippedProject(root);
    writeProjectFile(root, "data/gen.csv.js", LOADER);
    buildProject(root);
  }, 120_000);

  afterAll(() => {
    server?.kill();
  });

  it("serves the build: pages, ranged data reads, loader output, SPA fallback, clean SIGINT", async () => {
    server = await startBiacServer("preview", root);

    const page = await fetch(`${server.url}weekly-review`);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toMatch(/^text\/html/);
    const shell = await page.text();
    expect(shell).toContain('id="root"');

    // duckdb-wasm reads parquet footers with ranged GETs; a 200 with the
    // whole file would break every parquet source in a static deploy.
    const parquet = join(root, "build", "data", "flights.parquet");
    const ranged = await fetch(`${server.url}data/flights.parquet`, {
      headers: { Range: "bytes=0-3" },
    });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get("content-range")).toBe(
      `bytes 0-3/${statSync(parquet).size}`,
    );
    expect(await ranged.text()).toBe("PAR1");

    const generated = await fetch(`${server.url}data/gen.csv`);
    expect(generated.status).toBe(200);
    expect(await generated.text()).toBe(LOADER_OUTPUT);
    // The loader source was never copied: its path falls through to the shell.
    const source = await fetch(`${server.url}data/gen.csv.js`);
    expect(await source.text()).toBe(shell);

    const unknown = await fetch(`${server.url}nope`);
    expect(unknown.status).toBe(200);
    expect(await unknown.text()).toBe(shell);

    expect(await server.stop()).toBe(0);
  }, 60_000);

  it("exits 1 naming the missing build and the fix", () => {
    const empty = makeTempProject("biac-e2e-preview-empty-");

    const run = spawnSync(process.execPath, [biac, "preview", empty], {
      encoding: "utf8",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(join(empty, "build"));
    expect(run.stderr).toContain("run `biac build` first");
  });
});
