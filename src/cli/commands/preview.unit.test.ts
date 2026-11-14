import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  builtProject,
  fakePreviewServer,
} from "../../../test/lib/fake-preview.js";
import {
  cleanupProjects,
  makeTempProject,
} from "../../../test/lib/temp-project.js";
import { parsePreviewArgs, preview } from "./preview.js";

const { vitePreview } = vi.hoisted(() => ({ vitePreview: vi.fn() }));
vi.mock("vite", () => ({ preview: vitePreview }));

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
    const root = builtProject("biac-preview-");
    const server = fakePreviewServer();
    vitePreview.mockResolvedValue(server);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "once").mockImplementation(() => process);

    await preview([root, "--port", "0"]);

    const config = vitePreview.mock.calls[0]![0];
    expect(config.configFile).toMatch(/src[/\\]web[/\\]vite\.config\.ts$/);
    expect(config.build).toEqual({ outDir: join(root, "build") });
    expect(config.preview).toEqual({ cors: false, port: 0 });
    expect(server.printUrls).toHaveBeenCalledOnce();
  });

  it("leaves the port to vite when --port is absent", async () => {
    vitePreview.mockResolvedValue(fakePreviewServer());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "once").mockImplementation(() => process);

    await preview([builtProject("biac-preview-")]);

    expect(vitePreview.mock.calls[0]![0].preview).toEqual({ cors: false });
  });

  it("serves the framing policy from a middleware ahead of vite's, so a 304 carries it too", async () => {
    vitePreview.mockResolvedValue(fakePreviewServer());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "once").mockImplementation(() => process);
    const use = vi.fn();

    await preview([builtProject("biac-preview-")]);
    const [plugin] = vitePreview.mock.calls[0]![0].plugins;
    plugin.configurePreviewServer({ middlewares: { use } });

    expect(plugin.name).toBe("biac:preview-framing-policy");
    expect(use).toHaveBeenCalledExactlyOnceWith(expect.any(Function));
  });

  it("answers the listed data origins on /data from a middleware ahead of vite's", async () => {
    vitePreview.mockResolvedValue(fakePreviewServer());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "once").mockImplementation(() => process);
    const use = vi.fn();

    await preview([builtProject("biac-preview-")]);
    const plugin = vitePreview.mock.calls[0]![0].plugins[1];
    plugin.configurePreviewServer({ middlewares: { use } });

    expect(plugin.name).toBe("biac:preview-data-cors");
    expect(use).toHaveBeenCalledExactlyOnceWith("/data", expect.any(Function));
  });

  it("answers the listed data origins on /widgets from a middleware ahead of vite's", async () => {
    vitePreview.mockResolvedValue(fakePreviewServer());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "once").mockImplementation(() => process);
    const use = vi.fn();

    await preview([builtProject("biac-preview-")]);
    const plugin = vitePreview.mock.calls[0]![0].plugins[2];
    plugin.configurePreviewServer({ middlewares: { use } });

    expect(plugin.name).toBe("biac:preview-module-cors");
    expect(use).toHaveBeenCalledExactlyOnceWith(
      "/widgets",
      expect.any(Function),
    );
  });

  it("refuses a project with no build, naming the path and the fix", async () => {
    const root = makeTempProject("biac-preview-");

    await expect(preview([root])).rejects.toThrow(
      `biac preview: no build at ${join(root, "build")} — run \`biac build\` first`,
    );
    expect(vitePreview).not.toHaveBeenCalled();
  });

  it("hands the server to the SIGINT/SIGTERM shutdown", async () => {
    vitePreview.mockResolvedValue(fakePreviewServer());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const once = vi.spyOn(process, "once").mockImplementation(() => process);

    await preview([builtProject("biac-preview-")]);

    const signals = once.mock.calls.map(([signal]) => signal);
    expect(signals).toEqual(["SIGINT", "SIGTERM"]);
  });
});
