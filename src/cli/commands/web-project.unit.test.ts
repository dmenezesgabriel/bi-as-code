import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeOnExitSignals,
  parsePort,
  resolveProjectRoot,
  WEB_CONFIG,
} from "./web-project.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WEB_CONFIG", () => {
  it("points at the SPA's vite config", () => {
    expect(WEB_CONFIG).toMatch(/src[/\\]web[/\\]vite\.config\.ts$/);
  });
});

describe("resolveProjectRoot", () => {
  it("defaults to the current directory", () => {
    expect(resolveProjectRoot("build", [])).toBe(process.cwd());
  });

  it("resolves a positional project root against the current directory", () => {
    expect(resolveProjectRoot("build", ["site"])).toBe(`${process.cwd()}/site`);
  });

  it("rejects more than one project root, naming the command and values", () => {
    expect(() => resolveProjectRoot("build", ["a", "b"])).toThrow(
      "biac build takes at most one project directory, got: a, b",
    );
  });
});

describe("parsePort", () => {
  it("leaves an absent port to the web config", () => {
    expect(parsePort(undefined)).toBeUndefined();
  });

  it("parses a port, including 0 for an ephemeral port", () => {
    expect(parsePort("6000")).toBe(6000);
    expect(parsePort("0")).toBe(0);
  });

  it.each(["abc", "65536", "1.5", "-1"])(
    "rejects %s naming the value and the expected range",
    (port) => {
      expect(() => parsePort(port)).toThrow(
        `--port must be an integer in 0..65535, got "${port}"`,
      );
    },
  );
});

describe("closeOnExitSignals", () => {
  it.each(["SIGINT", "SIGTERM"])(
    "closes the server and exits 0 on %s",
    async (signal) => {
      const server = { close: vi.fn().mockResolvedValue(undefined) };
      const once = vi.spyOn(process, "once").mockImplementation(() => process);
      const exit = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      closeOnExitSignals(server);
      const shutdown = once.mock.calls.find(([sig]) => sig === signal)?.[1];
      (shutdown as () => void)();

      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
      expect(server.close).toHaveBeenCalledOnce();
    },
  );
});
