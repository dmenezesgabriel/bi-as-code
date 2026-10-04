import { afterEach, describe, expect, it, vi } from "vitest";
import type { ViteDevServer } from "vite";
import { dev, parseDevArgs } from "./dev.js";

const { createServer } = vi.hoisted(() => ({ createServer: vi.fn() }));
vi.mock("vite", () => ({ createServer }));

type FakeDevServer = Pick<ViteDevServer, "listen" | "close" | "printUrls">;

function fakeServer(): FakeDevServer {
  return {
    listen: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    printUrls: vi.fn(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  createServer.mockReset();
});

describe("parseDevArgs", () => {
  it("defaults to the current directory and no port override", () => {
    expect(parseDevArgs([])).toEqual({
      projectRoot: process.cwd(),
      port: undefined,
    });
  });

  it("resolves a positional project root", () => {
    expect(parseDevArgs(["site"]).projectRoot).toBe(`${process.cwd()}/site`);
  });

  it("parses --port, including 0 for an ephemeral port", () => {
    expect(parseDevArgs(["--port", "6000"]).port).toBe(6000);
    expect(parseDevArgs(["--port", "0"]).port).toBe(0);
  });

  it.each(["abc", "65536", "1.5"])(
    "rejects --port %s naming the value",
    (port) => {
      expect(() => parseDevArgs(["--port", port])).toThrow(port);
    },
  );

  it("rejects a negative --port naming the value", () => {
    // `--port -1` never reaches our validator — parseArgs reads -1 as a new
    // option; the inline `=` form does.
    expect(() => parseDevArgs(["--port=-1"])).toThrow("-1");
  });

  it("rejects more than one project root", () => {
    expect(() => parseDevArgs(["a", "b"])).toThrow("a, b");
  });

  it("rejects unknown flags", () => {
    expect(() => parseDevArgs(["--bogus"])).toThrow();
  });
});

describe("dev", () => {
  it("serves the web config with the pages plugin on the project root", async () => {
    const server = fakeServer();
    createServer.mockResolvedValue(server);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "once").mockImplementation(() => process);

    await dev(["--port", "0"]);

    const config = createServer.mock.calls[0]![0];
    expect(config.configFile).toMatch(/src[/\\]web[/\\]vite\.config\.ts$/);
    expect(config.plugins).toHaveLength(1);
    expect(config.plugins[0].name).toBe("biac:pages");
    expect(config.server).toEqual({ port: 0 });
    expect(server.listen).toHaveBeenCalledOnce();
    expect(server.printUrls).toHaveBeenCalledOnce();
  });

  it("leaves the port to the web config when --port is absent", async () => {
    createServer.mockResolvedValue(fakeServer());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "once").mockImplementation(() => process);

    await dev([]);

    expect(createServer.mock.calls[0]![0].server).toEqual({});
  });

  it("closes the server and exits on SIGINT", async () => {
    const server = fakeServer();
    createServer.mockResolvedValue(server);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const once = vi.spyOn(process, "once").mockImplementation(() => process);
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    await dev([]);
    const shutdown = once.mock.calls.find(([sig]) => sig === "SIGINT")?.[1];
    (shutdown as () => void)();

    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(server.close).toHaveBeenCalledOnce();
  });
});
