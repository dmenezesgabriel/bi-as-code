import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreviewServer } from "vite";
import {
  cleanupProjects,
  makeTempProject,
} from "../../../test/lib/temp-project.js";
import { parsePreviewArgs, preview } from "./preview.js";

const { vitePreview } = vi.hoisted(() => ({ vitePreview: vi.fn() }));
vi.mock("vite", () => ({ preview: vitePreview }));

type FakePreviewServer = Pick<PreviewServer, "close" | "printUrls">;

function fakeServer(): FakePreviewServer {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    printUrls: vi.fn(),
  };
}

function builtProject(): string {
  const root = makeTempProject("biac-preview-");
  mkdirSync(join(root, "build"));
  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
  vitePreview.mockReset();
  cleanupProjects();
});

describe("parsePreviewArgs", () => {
  it("defaults to the current directory and no port override", () => {
    expect(parsePreviewArgs([])).toEqual({
      projectRoot: process.cwd(),
      port: undefined,
    });
  });

  it("parses a positional project root and --port", () => {
    expect(parsePreviewArgs(["site", "--port", "0"])).toEqual({
      projectRoot: `${process.cwd()}/site`,
      port: 0,
    });
  });

  it("rejects more than one project root, naming the command", () => {
    expect(() => parsePreviewArgs(["a", "b"])).toThrow("biac preview");
  });

  it("rejects an invalid --port naming the value", () => {
    expect(() => parsePreviewArgs(["--port", "abc"])).toThrow("abc");
  });
});

describe("preview", () => {
  it("serves <project>/build with the web config on the given port", async () => {
    const root = builtProject();
    const server = fakeServer();
    vitePreview.mockResolvedValue(server);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "once").mockImplementation(() => process);

    await preview([root, "--port", "0"]);

    const config = vitePreview.mock.calls[0]![0];
    expect(config.configFile).toMatch(/src[/\\]web[/\\]vite\.config\.ts$/);
    expect(config.build).toEqual({ outDir: join(root, "build") });
    expect(config.preview).toEqual({ port: 0 });
    expect(server.printUrls).toHaveBeenCalledOnce();
  });

  it("leaves the port to vite when --port is absent", async () => {
    vitePreview.mockResolvedValue(fakeServer());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "once").mockImplementation(() => process);

    await preview([builtProject()]);

    expect(vitePreview.mock.calls[0]![0].preview).toEqual({});
  });

  it("serves the framing policy from a middleware ahead of vite's, so a 304 carries it too", async () => {
    vitePreview.mockResolvedValue(fakeServer());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "once").mockImplementation(() => process);
    const use = vi.fn();

    await preview([builtProject()]);
    const [plugin] = vitePreview.mock.calls[0]![0].plugins;
    plugin.configurePreviewServer({ middlewares: { use } });

    expect(plugin.name).toBe("biac:preview-framing-policy");
    expect(use).toHaveBeenCalledExactlyOnceWith(expect.any(Function));
  });

  it("refuses a project with no build, naming the path and the fix", async () => {
    const root = makeTempProject("biac-preview-");

    await expect(preview([root])).rejects.toThrow(
      `biac preview: no build at ${join(root, "build")} — run \`biac build\` first`,
    );
    expect(vitePreview).not.toHaveBeenCalled();
  });

  it("hands the server to the SIGINT/SIGTERM shutdown", async () => {
    vitePreview.mockResolvedValue(fakeServer());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const once = vi.spyOn(process, "once").mockImplementation(() => process);

    await preview([builtProject()]);

    const signals = once.mock.calls.map(([signal]) => signal);
    expect(signals).toEqual(["SIGINT", "SIGTERM"]);
  });
});
