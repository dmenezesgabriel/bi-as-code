import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build, parseBuildArgs } from "./build.js";
import type { ExportedWidgetModule } from "../../engine/widget-exports.js";

const { viteBuild, widgetExports } = vi.hoisted(() => ({
  viteBuild: vi.fn(),
  widgetExports: vi.fn<() => Promise<ExportedWidgetModule[]>>(async () => []),
}));

vi.mock("vite", () => ({ build: viteBuild }));
vi.mock("../../engine/widget-exports.js", () => ({
  widgetExports,
  widgetEntrySource: (
    module: { name: string },
    runtime: Record<string, string>,
  ) => `entry:${module.name}:${runtime.mountWidget}`,
}));

afterEach(() => {
  vi.restoreAllMocks();
  viteBuild.mockReset();
  widgetExports.mockReset();
  widgetExports.mockImplementation(async () => []);
});

describe("parseBuildArgs", () => {
  it("defaults to the current directory", () => {
    expect(parseBuildArgs([])).toEqual({ projectRoot: process.cwd() });
  });

  it("resolves a positional project root", () => {
    expect(parseBuildArgs(["site"]).projectRoot).toBe(`${process.cwd()}/site`);
  });

  it("rejects more than one project root, naming the command", () => {
    expect(() => parseBuildArgs(["a", "b"])).toThrow("biac build");
  });

  it("rejects unknown flags", () => {
    expect(() => parseBuildArgs(["--out", "x"])).toThrow();
  });
});

describe("build", () => {
  it("bundles the web config with the pages plugin into <project>/build", async () => {
    viteBuild.mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build(["site"]);

    const config = viteBuild.mock.calls[0]![0];
    expect(config.configFile).toMatch(/src[/\\]web[/\\]vite\.config\.ts$/);
    expect(config.plugins).toHaveLength(1);
    expect(config.plugins[0].name).toBe("biac:pages");
    expect(config.build).toEqual({
      outDir: join(process.cwd(), "site", "build"),
      emptyOutDir: true,
    });
  });

  it("prints the output directory once the bundle is written", async () => {
    viteBuild.mockResolvedValue(undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build(["site"]);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(join(process.cwd(), "site", "build")),
    );
  });
});

describe("build — widget modules", () => {
  const revenueByRegion = {
    name: "revenue-by-region",
    file: "pages/orders-dashboard.md",
    spec: {
      widget: "BarChart",
      props: {},
      sqlBlocks: [],
      sqlTables: {},
      cards: true,
    },
  };

  it("runs no second build when no page declares an export", async () => {
    viteBuild.mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build(["site"]);

    expect(viteBuild).toHaveBeenCalledTimes(1);
  });

  it("sweeps the exports after the SPA build, whose vite error names a broken page", async () => {
    viteBuild.mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build(["site"]);

    expect(viteBuild.mock.invocationCallOrder[0]!).toBeLessThan(
      widgetExports.mock.invocationCallOrder[0]!,
    );
  });

  it("emits one library-mode build beside the SPA, into build/ without emptying it", async () => {
    viteBuild.mockResolvedValue(undefined);
    widgetExports.mockResolvedValue([revenueByRegion]);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build(["site"]);

    expect(viteBuild).toHaveBeenCalledTimes(2);
    const config = viteBuild.mock.calls[1]![0];
    expect(config.base).toBe("");
    expect(config.define).toEqual({
      "process.env.NODE_ENV": '"production"',
      "global.process.env.NODE_ENV": '"production"',
      "globalThis.process.env.NODE_ENV": '"production"',
      "process.env": "{}",
      "global.process.env": "{}",
      "globalThis.process.env": "{}",
    });
    expect(config.build.outDir).toBe(join(process.cwd(), "site", "build"));
    expect(config.build.emptyOutDir).toBe(false);
    expect(config.build.assetsDir).toBe("assets");
    const entry = config.build.lib.entry["revenue-by-region"];
    expect(Object.keys(config.build.lib.entry)).toEqual(["revenue-by-region"]);
    expect(config.build.lib.formats).toEqual(["es"]);
    expect(entry).toMatch(/revenue-by-region\.js$/);
    expect(config.build.rollupOptions.output).toEqual({
      entryFileNames: "widgets/[name].js",
      chunkFileNames: "widgets/[name]-[hash].js",
    });
  });

  it("logs each emitted widget module's path", async () => {
    viteBuild.mockResolvedValue(undefined);
    widgetExports.mockResolvedValue([revenueByRegion]);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await build(["site"]);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(join("widgets", "revenue-by-region.js")),
    );
  });
});
