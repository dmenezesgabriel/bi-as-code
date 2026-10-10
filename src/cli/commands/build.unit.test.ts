import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build, parseBuildArgs } from "./build.js";

const { viteBuild } = vi.hoisted(() => ({ viteBuild: vi.fn() }));
vi.mock("vite", () => ({ build: viteBuild }));

afterEach(() => {
  vi.restoreAllMocks();
  viteBuild.mockReset();
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
