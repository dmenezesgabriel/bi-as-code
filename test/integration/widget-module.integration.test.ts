import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "@/cli/commands/build.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

// A string only the exported query carries — finding it in the emitted
// module proves the spec's sqlBlocks were baked, not just the props.
const SQL_MARKER = "widget-module-marker-5e1a";
const SQL = `select region, sum(amount) as revenue from orders group by region -- ${SQL_MARKER}`;
const CSV = "id,region,amount\n1,West,10\n2,East,20\n";

const dashboardPage = [
  "---",
  "cards: true",
  "sql:",
  "  orders: data/orders.csv",
  "---",
  "",
  "```sql region_revenue",
  SQL,
  "```",
  "",
  '<BarChart data="region_revenue" x="region" y="revenue" title="Revenue by region" export="revenue-by-region" />',
  "",
].join("\n");

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjects();
});

describe("biac build — widget modules", () => {
  it("emits an importable module beside the SPA with the spec baked and the runtime inlined", async () => {
    const root = makeTempProject();
    writeProjectFile(root, "pages/index.md", dashboardPage);
    writeProjectFile(root, "data/orders.csv", CSV);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build([root]);

    const moduleFile = join(root, "build", "widgets", "revenue-by-region.js");
    expect(existsSync(moduleFile)).toBe(true);
    const source = readFileSync(moduleFile, "utf8");
    expect(source).toContain(SQL_MARKER);
    expect(source).toContain("Revenue by region");
    // No runtime URL may resolve against the host page: root-relative
    // asset paths would fetch the host's origin and 404 there.
    expect(source).not.toContain('"/assets/');
    // The wasm and worker ride inside the module — vite's library build
    // inlines every asset — so the module boots its runtime from itself,
    // needing no grant beyond the module file and /data/.
    expect(source).toContain("data:application/wasm;base64");
    expect(source).toContain("data:text/javascript;base64");
    // The lib build bakes production semantics: react-dom's interop reads
    // process.env.NODE_ENV at module scope, and a browser has no process —
    // regression guard for the define the lib build must mirror.
    expect(source).not.toContain("process.env.NODE_ENV");
    // The data origin is the module's own: registration resolves /data/
    // against import.meta.url's origin, not the host page's.
    expect(source).toContain("import.meta.url");
    // duckdb-wasm's browser glue reads the global Worker at import (its
    // duckdb-browser.mjs evaluates `__toESM(Worker)` at module scope), so
    // node needs the global present to link the module — the real worker
    // start is browser behavior, validated by the playwright-cli pass.
    const WorkerStub = class WorkerStub {};
    const hadWorker = "Worker" in globalThis;
    const realWorker = globalThis.Worker;
    globalThis.Worker = WorkerStub as unknown as typeof Worker;
    try {
      const imported = await import(pathToFileURL(moduleFile).href);
      expect(typeof imported.default).toBe("function");
    } finally {
      if (hadWorker) globalThis.Worker = realWorker!;
      else delete (globalThis as { Worker?: unknown }).Worker;
    }
  }, 240_000);

  it("emits no second copy of the wasm and worker — they ride inside the module", async () => {
    const root = makeTempProject();
    writeProjectFile(root, "pages/index.md", dashboardPage);
    writeProjectFile(root, "data/orders.csv", CSV);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build([root]);

    const assets = readdirSync(join(root, "build", "assets")).filter((name) =>
      name.startsWith("duckdb-"),
    );
    // The SPA build's own four: one wasm and one worker per bundle kind
    // (mvp + eh). The lib build emitted none — its assets are inlined.
    expect(assets.filter((name) => name.endsWith(".wasm"))).toHaveLength(2);
    expect(
      assets.filter((name) => /\.worker-[^.]+\.js$/.test(name)),
    ).toHaveLength(2);
  }, 240_000);

  it("emits no widgets directory when no page declares an export", async () => {
    const root = makeTempProject();
    writeProjectFile(root, "pages/index.md", "# No exports\n");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build([root]);

    expect(existsSync(join(root, "build", "widgets"))).toBe(false);
  }, 240_000);

  it("fails the build naming both pages when two declare one export name", async () => {
    const root = makeTempProject();
    writeProjectFile(root, "pages/index.md", dashboardPage);
    writeProjectFile(
      root,
      "pages/other.md",
      [
        "```sql q",
        SQL,
        "```",
        "",
        '<BarChart data="q" x="region" y="revenue" export="revenue-by-region" />',
        "",
      ].join("\n"),
    );
    writeProjectFile(root, "data/orders.csv", CSV);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(build([root])).rejects.toThrow(
      /Export name "revenue-by-region" is declared in pages\/index\.md and pages\/other\.md/,
    );
    // The failure comes after the SPA build, whose output is complete and
    // valid; the duplicate name emits no widget module.
    expect(existsSync(join(root, "build", "widgets"))).toBe(false);
  }, 240_000);
});
