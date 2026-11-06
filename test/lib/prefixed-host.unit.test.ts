import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { servePrefixed } from "./prefixed-host.js";
import type { StaticDir } from "./static-server.js";

describe("servePrefixed", () => {
  const scratch: string[] = [];
  let host: StaticDir | undefined;

  afterEach(async () => {
    await host?.close();
    host = undefined;
    for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true });
  });

  function buildWithIndex(): string {
    const buildDir = mkdtempSync(join(tmpdir(), "biac-prefixed-build-"));
    scratch.push(buildDir);
    mkdirSync(join(buildDir, "docs"));
    writeFileSync(join(buildDir, "index.html"), "<title>home</title>");
    writeFileSync(join(buildDir, "docs", "index.html"), "<title>docs</title>");
    return buildDir;
  }

  it("answers the build's routes beneath the prefix and nothing above it", async () => {
    // Arrange
    host = await servePrefixed(buildWithIndex(), "bi-as-code");

    // Act
    const home = await fetch(`${host.url}/bi-as-code/`);
    const nested = await fetch(`${host.url}/bi-as-code/docs/`);
    const root = await fetch(`${host.url}/`);

    // Assert — a project site has no page at its origin's root.
    expect(await home.text()).toBe("<title>home</title>");
    expect(await nested.text()).toBe("<title>docs</title>");
    expect(root.status).toBe(404);
  });

  it("serves each extra file from the origin's root", async () => {
    // Arrange
    host = await servePrefixed(buildWithIndex(), "bi-as-code", {
      "host.html": "<title>host</title>",
    });

    // Act
    const response = await fetch(`${host.url}/host.html`);

    // Assert
    expect(await response.text()).toBe("<title>host</title>");
  });

  it("removes the directory it served from when closed, and only that one", async () => {
    // Arrange
    const buildDir = buildWithIndex();
    const hostRoots = (): string[] =>
      readdirSync(tmpdir()).filter((name) =>
        name.startsWith("biac-prefixed-host-"),
      );
    const before = hostRoots().length;
    host = await servePrefixed(buildDir, "bi-as-code");
    expect(hostRoots()).toHaveLength(before + 1);

    // Act
    await host.close();
    host = undefined;

    // Assert — the build it copied from is the caller's and stays.
    expect(hostRoots()).toHaveLength(before);
    expect(existsSync(join(buildDir, "index.html"))).toBe(true);
  });
});
