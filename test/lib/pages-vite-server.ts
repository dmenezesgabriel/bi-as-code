import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { expect, vi } from "vitest";
import { pagesPlugin } from "@/engine/pages-plugin.js";

const webRoot = fileURLToPath(new URL("../../src/web", import.meta.url));

/**
 * Real vite dev server with `src/web` as root, matching `biac dev`: pages
 * live outside the vite root, so every request goes through `/@fs/` and the
 * plugin's `server.fs.allow` grant.
 */
export function makePagesServer(root: string): Promise<ViteDevServer> {
  return createServer({
    root: webRoot,
    configFile: false,
    logLevel: "error",
    plugins: [pagesPlugin(root)],
    server: { middlewareMode: true },
  });
}

/**
 * Polls until chokidar has finished scanning `dir` — its `getWatched()`
 * entry only lists files once that directory's readdir completed, so a
 * write afterwards is guaranteed to arrive as a real event (vite's watcher
 * runs `ignoreInitial`, which swallows files discovered mid-scan). Unlike
 * `ready`, this cannot race: a `ready` listener attached after
 * `createServer` can miss a scan that finished during server setup.
 */
export async function waitForWatch(
  dev: ViteDevServer,
  dir: string,
  fileName: string,
): Promise<void> {
  await vi.waitFor(
    () => {
      expect(dev.watcher.getWatched()[dir]).toContain(fileName);
    },
    { timeout: 10000 },
  );
}
