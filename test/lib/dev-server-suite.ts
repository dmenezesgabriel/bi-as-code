import type { ViteDevServer } from "vite";
import { afterEach, vi } from "vitest";
import { closeDevServers, makePagesServer } from "./pages-vite-server.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFiles,
} from "./temp-project.js";

/** How long a filesystem mutation may take to reach vite's watcher. */
export const WATCH_WAIT_MS = 10_000;

/**
 * The lifecycle every suite that boots a vite dev server shares: its servers
 * and temp projects are removed after each test, and the test timeout covers
 * a boot plus one {@link WATCH_WAIT_MS} watcher wait, which vitest's 5s
 * default would cut short on a loaded host. Call it once at module level.
 *
 * @example
 * registerDevServerLifecycle();
 * const dev = await makePagesServer(makeTempProject());
 */
export function registerDevServerLifecycle(): void {
  vi.setConfig({ testTimeout: 2 * WATCH_WAIT_MS });
  afterEach(async () => {
    await closeDevServers();
    cleanupProjects();
  });
}

/** A dev server over a new temp project holding `files`, closed by the registered lifecycle. */
export async function serveProjectFiles(
  files: Record<string, string>,
): Promise<{ root: string; dev: ViteDevServer }> {
  const root = makeTempProject();
  writeProjectFiles(root, files);
  return { root, dev: await makePagesServer(root) };
}
