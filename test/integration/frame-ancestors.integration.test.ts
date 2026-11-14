import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ViteDevServer } from "vite";
import { describe, expect, it, vi } from "vitest";
import { DENY_ALL, framingPolicy } from "../lib/framing-policy.js";
import {
  registerDevServerLifecycle,
  WATCH_WAIT_MS,
} from "../lib/dev-server-suite.js";
import {
  listenPagesServer,
  makePagesServer,
  waitForWatch,
} from "../lib/pages-vite-server.js";
import { makeTempProject, writeProjectFile } from "../lib/temp-project.js";

registerDevServerLifecycle();

/** A dev server on a project with one page and one data file, after `config` is written as its biac.config.ts. */
async function serve(
  config?: string,
): Promise<{ root: string; baseUrl: string; dev: ViteDevServer }> {
  const root = makeTempProject();
  writeProjectFile(root, "pages/weekly.md", "# Weekly\n");
  writeProjectFile(root, "data/orders.csv", "id\n1\n");
  if (config !== undefined) writeProjectFile(root, "biac.config.ts", config);
  const dev = await makePagesServer(root);
  const http = await listenPagesServer(dev);
  return { root, baseUrl: http.url, dev };
}

describe("biac dev framing policy", () => {
  it("denies every framer on the shell, a deep link, a data file and a module when no origin is listed", async () => {
    const { baseUrl } = await serve();

    const paths = ["/", "/weekly", "/data/orders.csv", "/@vite/client"];
    const policies = await Promise.all(
      paths.map((path) => framingPolicy(`${baseUrl}${path}`)),
    );

    expect(policies).toEqual(paths.map(() => DENY_ALL));
  });

  it("allows exactly the origins biac.config.ts lists", async () => {
    const { baseUrl } = await serve(
      'export default { embed: { origins: ["http://localhost:8901", "https://intranet.example.com"] } };\n',
    );

    const policy = await framingPolicy(`${baseUrl}/weekly`);

    expect(policy).toEqual({
      csp: "frame-ancestors http://localhost:8901 https://intranet.example.com",
      xfo: "DENY",
    });
  });

  it("applies an edited origin list on the next request, without a restart", async () => {
    const { root, baseUrl, dev } = await serve("export default {};\n");
    await waitForWatch(dev, root, "biac.config.ts");
    await framingPolicy(`${baseUrl}/weekly`);

    writeFileSync(
      join(root, "biac.config.ts"),
      'export default { embed: { origins: ["http://localhost:8901"] } };\n',
    );

    await vi.waitFor(
      async () =>
        expect((await framingPolicy(`${baseUrl}/weekly`)).csp).toBe(
          "frame-ancestors http://localhost:8901",
        ),
      { timeout: WATCH_WAIT_MS },
    );
  });
});
