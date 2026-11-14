import { utimesSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, type MockInstance } from "vitest";
import {
  registerDevServerLifecycle,
  WATCH_WAIT_MS,
} from "../lib/dev-server-suite.js";
import { makePagesServer, waitForWatch } from "../lib/pages-vite-server.js";
import { makeTempProject, writeProjectFile } from "../lib/temp-project.js";

registerDevServerLifecycle();

/** Boots a dev server over `root` once chokidar lists `data/<fileName>`. */
async function watchedServer(
  root: string,
  fileName: string,
): Promise<MockInstance> {
  const dev = await makePagesServer(root);
  await waitForWatch(dev, join(root, "data"), fileName);
  return vi.spyOn(dev.environments.client.hot, "send");
}

/** Moves a file's mtime forward so the watcher reports a real change. */
function touchLater(file: string): void {
  const later = new Date(Date.now() + 60_000);
  utimesSync(file, later, later);
}

async function expectDataUpdate(
  send: MockInstance,
  path: string,
): Promise<void> {
  await vi.waitFor(
    () => {
      expect(send).toHaveBeenCalledWith("biac:data-update", {
        path,
        version: expect.any(Number),
      });
    },
    { timeout: WATCH_WAIT_MS },
  );
}

function fullReloads(send: MockInstance): unknown[] {
  return send.mock.calls.filter(
    ([payload]) =>
      typeof payload === "object" &&
      (payload as { type?: string }).type === "full-reload",
  );
}

describe("data file watching", () => {
  it("sends a data update, and no reload, when a static file is rewritten", async () => {
    const root = makeTempProject();
    writeProjectFile(root, "data/a.csv", "x\n1\n");
    writeProjectFile(root, "pages/index.md", "# Hi\n");
    const send = await watchedServer(root, "a.csv");

    writeProjectFile(root, "data/a.csv", "x\n2\n");
    touchLater(join(root, "data/a.csv"));

    await expectDataUpdate(send, "data/a.csv");
    expect(fullReloads(send)).toEqual([]);
  });

  it("sends the generated target's path when a loader is edited", async () => {
    const root = makeTempProject();
    writeProjectFile(root, "data/x.csv.js", "process.stdout.write('x\\n1');\n");
    writeProjectFile(root, "pages/index.md", "# Hi\n");
    const send = await watchedServer(root, "x.csv.js");

    writeProjectFile(root, "data/x.csv.js", "process.stdout.write('x\\n2');\n");
    touchLater(join(root, "data/x.csv.js"));

    await expectDataUpdate(send, "data/x.csv");
    expect(fullReloads(send)).toEqual([]);
  });
});
