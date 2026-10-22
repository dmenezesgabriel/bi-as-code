import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildCli,
  buildProject,
  startBiacServer,
  type DevServer,
} from "../lib/dev-server.js";
import {
  DENY_ALL,
  framingPolicy,
  revalidatedFramingPolicy,
  withEmbedOrigins,
} from "../lib/framing-policy.js";
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

  it("writes the brand colours, palette, scale and fonts into build/index.html", () => {
    const root = makeTempProject("biac-e2e-build-brand-");
    writeProjectFile(root, "pages/index.md", "# Branded\n");
    writeProjectFile(
      root,
      "biac.config.ts",
      'export default { brand: { colors: { primary: { light: "#154886", dark: "#60a5fa" } }, palette: { light: ["#1e40af"] }, scale: { dark: ["#60a5fa"] }, fonts: { body: "serif" } } };\n',
    );

    execFileSync(process.execPath, [biac, "build", root], { encoding: "utf8" });

    const html = readFileSync(join(root, "build", "index.html"), "utf8");
    expect(html).toContain("--primary: #154886;");
    expect(html).toContain("--primary: #60a5fa;");
    expect(html).toContain("--chart-1: #1e40af;");
    expect(html).toContain("--chart-scale: #60a5fa;");
    expect(html).toContain("--body-font: var(--font-stack-serif);");
  }, 120_000);

  it("ships every font stack a brand can name in the built stylesheet", () => {
    const root = makeTempProject("biac-e2e-build-font-stacks-");
    writeProjectFile(root, "pages/index.md", "# Plain\n");

    execFileSync(process.execPath, [biac, "build", root], { encoding: "utf8" });

    const assets = join(root, "build", "assets");
    const css = readdirSync(assets)
      .filter((name) => name.endsWith(".css"))
      .map((name) => readFileSync(join(assets, name), "utf8"))
      .join("");
    for (const token of ["--font-sans", "--font-serif", "--font-mono"]) {
      expect(css).toMatch(new RegExp(`${token}:\\s*\\S`));
    }
  }, 120_000);

  it.each([
    [
      "a brand colour",
      "biac-e2e-build-brand-contrast-",
      '  brand: { colors: { background: { light: "#fdf6e3", dark: "#0a0a0a" } } },',
      "Invalid biac.config.ts:2:36 — brand.colors.background.light: #fdf6e3 against --chart-4 #cc79a7 measures 2.83:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light",
    ],
    [
      "a palette colour",
      "biac-e2e-build-brand-palette-",
      '  brand: { palette: { light: ["#45a1bf"] } },',
      "Invalid biac.config.ts:2:31 — brand.palette.light[0]: #45a1bf against --background #ffffff measures 2.95:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.palette.light[0]",
    ],
    [
      "a delta tone",
      "biac-e2e-build-brand-positive-",
      '  brand: { colors: { positive: { light: "#4ade80", dark: "#34d399" } } },',
      "Invalid biac.config.ts:2:34 — brand.colors.positive.light: #4ade80 against --background #ffffff measures 1.74:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.positive.light",
    ],
    [
      "a field surface",
      "biac-e2e-build-brand-field-",
      '  brand: { colors: { field: { light: "#f0f0f0", dark: "#171717" } } },',
      "Invalid biac.config.ts:2:31 — brand.colors.field.light: #f0f0f0 against --muted-foreground-faded #737373 measures 4.16:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.field.light",
    ],
  ])(
    "exits 1 naming %s under its contrast floor",
    (_what, prefix, brandLine, message) => {
      const root = makeTempProject(prefix);
      writeProjectFile(root, "pages/index.md", "# Branded\n");
      writeProjectFile(
        root,
        "biac.config.ts",
        `export default {\n${brandLine}\n};\n`,
      );

      const run = spawnSync(process.execPath, [biac, "build", root], {
        encoding: "utf8",
      });

      expect(run.status).toBe(1);
      expect(run.stderr).toContain(message);
    },
    120_000,
  );

  it("ships a page's front-matter brand in that page's own chunk", () => {
    const root = makeTempProject("biac-e2e-build-page-brand-");
    writeProjectFile(root, "pages/index.md", "# Home\n");
    writeProjectFile(
      root,
      "pages/branded.md",
      '---\nbrand:\n  palette:\n    dark: ["#60a5fa"]\n---\n# Branded\n',
    );

    execFileSync(process.execPath, [biac, "build", root], { encoding: "utf8" });

    const assets = join(root, "build", "assets");
    const carriers = readdirSync(assets).filter((name) =>
      readFileSync(join(assets, name), "utf8").includes("--chart-1: #60a5fa;"),
    );
    expect(carriers).toEqual([expect.stringMatching(/^branded-.*\.js$/)]);
    const html = readFileSync(join(root, "build", "index.html"), "utf8");
    expect(html).not.toContain("--chart-1: #60a5fa;");
  }, 120_000);

  it("ships translations resolved, without the i18next runtime", () => {
    const root = makeTempProject("biac-e2e-build-translations-");
    // Out of site search, whose chunk would carry the resolved title too:
    // this test counts the chunks the translations module ships in.
    writeProjectFile(
      root,
      "pages/index.md",
      "---\nindex: false\n---\n# {$translations.title}\n",
    );
    writeProjectFile(
      root,
      "translations.yaml",
      "en:\n  brand: Acme\n  title: $t(brand) weekly\nfr:\n  title: Hebdo\n",
    );

    execFileSync(process.execPath, [biac, "build", root], { encoding: "utf8" });

    const assets = join(root, "build/assets");
    const carriers = (text: string) =>
      readdirSync(assets).filter(
        (name) =>
          name.endsWith(".js") &&
          readFileSync(join(assets, name), "utf8").includes(text),
      );
    expect(carriers("Acme weekly")).toHaveLength(1);
    expect(carriers("Hebdo")).toEqual(carriers("Acme weekly"));
    expect(carriers("$t(brand)")).toEqual([]);
    expect(carriers("i18next")).toEqual([]);
  }, 120_000);

  it("fails the build on a malformed translations.yaml, naming its line", () => {
    const root = makeTempProject("biac-e2e-build-bad-translations-");
    writeProjectFile(root, "pages/index.md", "# {$translations.title}\n");
    writeProjectFile(root, "translations.yaml", "en:\n  title: T\n bad: 1\n");

    const run = () =>
      execFileSync(process.execPath, [biac, "build", root], {
        encoding: "utf8",
        stdio: "pipe",
      });

    expect(run).toThrow(/Invalid translations\.yaml:3:\d+/);
  }, 120_000);

  it("ships a query file only inside the chunk of the page that names it, directly or through another file", () => {
    const root = makeTempProject("biac-e2e-build-query-files-");
    writeProjectFile(root, "pages/index.md", "# Home\n");
    writeProjectFile(
      root,
      "pages/report.md",
      '# Report\n\n<Table data="/queries/totals" />\n',
    );
    writeProjectFile(
      root,
      "pages/share.md",
      "# Share\n\n```sql share\nselect * from {{/queries/outer}}\n```\n",
    );
    writeProjectFile(root, "queries/totals.sql", "select 'shipped-query'\n");
    writeProjectFile(
      root,
      "queries/outer.sql",
      "select * from {{/queries/inner}}\n",
    );
    writeProjectFile(root, "queries/inner.sql", "select 'nested-query'\n");
    writeProjectFile(root, "queries/unused.sql", "select 'never-shipped'\n");

    execFileSync(process.execPath, [biac, "build", root], { encoding: "utf8" });

    const build = join(root, "build");
    const carriers = (text: string) =>
      readdirSync(build, { recursive: true, encoding: "utf8" }).filter(
        (name) =>
          statSync(join(build, name)).isFile() &&
          readFileSync(join(build, name), "utf8").includes(text),
      );
    expect(carriers("shipped-query")).toEqual([
      expect.stringMatching(/^assets\/report-.*\.js$/),
    ]);
    expect(carriers("nested-query")).toEqual([
      expect.stringMatching(/^assets\/share-.*\.js$/),
    ]);
    expect(carriers("never-shipped")).toEqual([]);
  }, 120_000);

  it("exits 1 naming a page brand colour under its floor on the project brand", () => {
    const root = makeTempProject("biac-e2e-build-page-brand-contrast-");
    writeProjectFile(
      root,
      "biac.config.ts",
      'export default { brand: { colors: { primary: { light: "#154886", dark: "#60a5fa" } } } };\n',
    );
    writeProjectFile(
      root,
      "pages/index.md",
      '---\nbrand:\n  colors:\n    background: { light: "#3b5c99", dark: "#0a0a0a" }\n---\n# Home\n',
    );

    const run = spawnSync(process.execPath, [biac, "build", root], {
      encoding: "utf8",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      "Invalid front-matter in pages/index.md — brand.colors.background.light: #3b5c99 against --primary #154886 measures 1.37:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light",
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

  // The SPA shell, a deep link through the SPA fallback, and a data file the build copies.
  const FRAMED_PATHS = ["", "weekly-review", "data/channels.csv"];

  function listOrigins(origins: readonly string[]): void {
    const config = readFileSync(join(root, "biac.config.ts"), "utf8");
    writeProjectFile(root, "biac.config.ts", withEmbedOrigins(config, origins));
  }

  async function framingPolicies(url: string): Promise<unknown[]> {
    return Promise.all(
      FRAMED_PATHS.map((path) => framingPolicy(`${url}${path}`)),
    );
  }

  it("denies every framer on the shell, a deep link and a data file when no origin is listed", async () => {
    server = await startBiacServer("preview", root);

    const policies = await framingPolicies(server.url);

    expect(policies).toEqual(FRAMED_PATHS.map(() => DENY_ALL));
    expect(await server.stop()).toBe(0);
  }, 60_000);

  it("keeps the policy on a 304, so a cached page is not framed under an earlier list", async () => {
    server = await startBiacServer("preview", root);

    const policies = await Promise.all(
      FRAMED_PATHS.map((path) =>
        revalidatedFramingPolicy(`${server!.url}${path}`),
      ),
    );

    expect(policies).toEqual(
      FRAMED_PATHS.map(() => ({ status: 304, ...DENY_ALL })),
    );
    expect(await server.stop()).toBe(0);
  }, 60_000);

  it("allows exactly the origins biac.config.ts lists", async () => {
    listOrigins(["http://localhost:8901"]);
    server = await startBiacServer("preview", root);

    const policies = await framingPolicies(server.url);

    expect(policies).toEqual(
      FRAMED_PATHS.map(() => ({
        csp: "frame-ancestors http://localhost:8901",
        xfo: "DENY",
      })),
    );
    expect(await server.stop()).toBe(0);
  }, 60_000);

  it("exits 1 naming an origin with a path at its line and column", () => {
    listOrigins(["https://example.com/path"]);

    const run = spawnSync(process.execPath, [biac, "preview", root], {
      encoding: "utf8",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(
      /Invalid biac\.config\.ts:\d+:\d+ — embed\.origins\[0\]: expected an origin "scheme:\/\/host\[:port\]" \(http or https, no path, no wildcard\), got "https:\/\/example\.com\/path"/,
    );
  });

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
