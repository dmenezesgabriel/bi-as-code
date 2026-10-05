import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
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
 * Binds `dev.middlewares` to a real socket — `makePagesServer` runs
 * middlewareMode (no listener), so middleware-level routes like `/data/`
 * need this wrapper before `fetch` can reach them. Port 0 picks an
 * OS-assigned port; the returned URL is the only honest way to learn it.
 */
export async function listenPagesServer(
  dev: ViteDevServer,
): Promise<{ url: string; close: () => Promise<void> }> {
  const http: Server = createHttpServer(dev.middlewares);
  await new Promise<void>((resolve) => http.listen(0, resolve));
  const { port } = http.address() as AddressInfo;
  return {
    url: `http://localhost:${port}`,
    close: () => new Promise<void>((done) => http.close(() => done())),
  };
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
