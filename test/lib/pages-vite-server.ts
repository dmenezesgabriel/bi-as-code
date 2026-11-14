import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { expect, vi } from "vitest";
import { pagesPlugin } from "@/engine/pages-plugin.js";

const webRoot = fileURLToPath(new URL("../../src/web", import.meta.url));

/** Everything this module started, closed newest first by {@link closeDevServers}. */
const opened: { close: () => Promise<unknown> }[] = [];

/**
 * Closes every server and socket made by {@link makePagesServer} and
 * {@link listenPagesServer} since the last call, newest first so a socket
 * goes before the vite server behind it.
 */
export async function closeDevServers(): Promise<void> {
  while (opened.length > 0) {
    await opened.pop()!.close();
  }
}

/**
 * Real vite dev server with `src/web` as root, matching `biac dev`: pages
 * live outside the vite root, so every request goes through `/@fs/` and the
 * plugin's `server.fs.allow` grant. The dep optimizer is off.
 */
export async function makePagesServer(root: string): Promise<ViteDevServer> {
  const dev = await createServer({
    root: webRoot,
    configFile: false,
    logLevel: "error",
    plugins: [pagesPlugin(root)],
    server: { middlewareMode: true },
    // `configFile: false` never hashes to `biac dev`'s deps configHash, so an
    // optimizer here would drop the shared `src/web/node_modules/.vite/deps`
    // and leak a `deps_temp_*` dir when closed mid-optimize. vite documents
    // `noDiscovery` with no `include` as turning the optimizer off.
    optimizeDeps: { noDiscovery: true },
  });
  opened.push(dev);
  return dev;
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
  const close = (): Promise<void> =>
    new Promise<void>((done) => http.close(() => done()));
  opened.push({ close });
  return { url: `http://localhost:${port}`, close };
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

/** Asserts `act()` (a filesystem mutation) bumps the module's invalidation timestamp. */
export async function expectInvalidated(
  module: { lastInvalidationTimestamp: number } | undefined,
  act: () => void,
): Promise<void> {
  const timestamp = module!.lastInvalidationTimestamp;
  act();
  await vi.waitFor(
    () => {
      expect(module!.lastInvalidationTimestamp).toBeGreaterThan(timestamp);
    },
    { timeout: 10000 },
  );
}
