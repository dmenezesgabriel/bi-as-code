import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WEB_CONFIG } from "@/cli/commands/web-project.js";

const WEB_SRC = fileURLToPath(new URL("../../src/web/src/", import.meta.url));
// The throwaway dep cache goes on disk: the temp dir may be tmpfs (RAM).
const cacheParent = fileURLToPath(
  new URL("../../node_modules/.cache/", import.meta.url),
);

let cacheDir: string;
let web: ViteDevServer;

/** Every `virtual:biac-*` id the SPA declares in its `virtual-*.d.ts` files. */
function declaredVirtualModules(): string[] {
  return readdirSync(WEB_SRC)
    .filter((file) => /^virtual-.*\.d\.ts$/.test(file))
    .flatMap((file) =>
      [
        ...readFileSync(join(WEB_SRC, file), "utf8").matchAll(
          /declare module "(virtual:biac-[^"]+)"/g,
        ),
      ].map((match) => match[1]!),
    );
}

beforeAll(async () => {
  mkdirSync(cacheParent, { recursive: true });
  cacheDir = mkdtempSync(join(cacheParent, "web-build-fallback-"));
  web = await createServer({
    configFile: WEB_CONFIG,
    cacheDir,
    logLevel: "error",
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
});

afterAll(async () => {
  await web?.close();
  rmSync(cacheDir, { recursive: true, force: true });
});

describe("the SPA's own vite config without the pages plugin", () => {
  it.each(declaredVirtualModules())(
    "resolves and loads %s from the empty-project fallback",
    async (id) => {
      // Arrange
      const container = web.environments.client.pluginContainer;

      // Act
      const resolved = await container.resolveId(id);
      const loaded = resolved && (await container.load(resolved.id));

      // Assert
      expect(resolved?.id, `add ${id} to emptyProjectFallback`).toEqual(
        expect.stringMatching(/^\0biac:empty-/),
      );
      expect(loaded).toEqual(expect.stringContaining("export"));
    },
  );

  it("serves a config stub with every field AppShell dereferences", async () => {
    // Arrange
    const container = web.environments.client.pluginContainer;

    // Act
    const loaded = await container.load("\0biac:empty-config");
    if (typeof loaded !== "string") {
      throw new Error(
        `the config stub loaded as ${typeof loaded}, expected source text`,
      );
    }

    // Assert — `embed.origins` and `layout` are read unconditionally
    // (AppShell's frame-height reporter and page-router's layout merge);
    // a stub missing them renders the error boundary.
    expect(JSON.parse(/export const config = (.*);/.exec(loaded)![1]!)).toEqual(
      {
        title: "biac",
        theme: "system",
        nav: { sidebar: true },
        sqlTables: {},
        layout: {
          page_width: "article",
          cards: false,
          table_of_contents: true,
          table_of_contents_label: "On this page",
        },
        embed: { origins: [] },
      },
    );
  });
});
