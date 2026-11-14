import { existsSync } from "node:fs";
import {
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { registerDevServerLifecycle } from "../lib/dev-server-suite.js";
import {
  closeDevServers,
  listenPagesServer,
  makePagesServer,
} from "../lib/pages-vite-server.js";
import { makeTempProject, writeProjectFile } from "../lib/temp-project.js";

afterEach(closeDevServers);

async function startedProject(): Promise<string> {
  const root = makeTempProject("biac-lifecycle-");
  writeProjectFile(root, "pages/index.md", "# Home\n");
  return root;
}

describe("closeDevServers", () => {
  it("closes every vite server made since the last call, once", async () => {
    const first = await makePagesServer(await startedProject());
    const second = await makePagesServer(await startedProject());
    const closeFirst = vi.spyOn(first, "close");
    const closeSecond = vi.spyOn(second, "close");

    await closeDevServers();
    await closeDevServers();

    expect(closeFirst).toHaveBeenCalledTimes(1);
    expect(closeSecond).toHaveBeenCalledTimes(1);
  });

  it("stops the socket a server was bound to", async () => {
    const dev = await makePagesServer(await startedProject());
    const { url } = await listenPagesServer(dev);
    expect((await fetch(url)).status).toBeGreaterThan(0);

    await closeDevServers();

    await expect(fetch(url)).rejects.toThrow();
  });
});

describe("registerDevServerLifecycle", () => {
  registerDevServerLifecycle();
  let root = "";
  let closeServer: MockInstance | undefined;

  it("serves a project the hooks then clean up", async () => {
    root = await startedProject();
    closeServer = vi.spyOn(await makePagesServer(root), "close");

    expect(existsSync(root)).toBe(true);
  });

  // Runs after the test's own afterEach hooks, which are under test here.
  afterAll(() => {
    expect(closeServer).toHaveBeenCalledTimes(1);
    expect(existsSync(root)).toBe(false);
  });
});
