import { describe, expect, it } from "vitest";
import { resolveProjectRoot, WEB_CONFIG } from "./web-project.js";

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
