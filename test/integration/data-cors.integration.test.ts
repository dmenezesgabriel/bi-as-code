import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ViteDevServer } from "vite";
import { describe, expect, it, vi } from "vitest";
import { corsPolicy } from "../lib/cors-policy.js";
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

const LISTED = "http://127.0.0.1:8901";
const UNLISTED = "http://127.0.0.1:8902";
const EXPOSED = "Content-Range, Accept-Ranges";
const LOADER = 'process.stdout.write("id\\n1\\n");\n';

/** A dev server on a project with a page, a csv, a loader and `config` as its biac.config.ts. */
async function serve(
  config: string,
): Promise<{ root: string; baseUrl: string; dev: ViteDevServer }> {
  const root = makeTempProject();
  writeProjectFile(root, "pages/weekly.md", "# Weekly\n");
  writeProjectFile(root, "data/orders.csv", "id\n1\n");
  writeProjectFile(root, "data/gen.csv.js", LOADER);
  writeProjectFile(root, "biac.config.ts", config);
  const dev = await makePagesServer(root);
  const http = await listenPagesServer(dev);
  return { root, baseUrl: http.url, dev };
}

const LISTING_CONFIG = `export default { embed: { dataOrigins: ["${LISTED}"] } };\n`;

describe("biac dev /data/ CORS", () => {
  it.each([
    ["a file", "/data/orders.csv", {}],
    ["a byte range", "/data/orders.csv", { headers: { Range: "bytes=0-1" } }],
    ["a HEAD", "/data/orders.csv", { method: "HEAD" }],
    ["a loader output", "/data/gen.csv", {}],
  ])("echoes a listed origin on %s", async (_case, path, init) => {
    const { baseUrl } = await serve(LISTING_CONFIG);

    const policy = await corsPolicy(`${baseUrl}${path}`, LISTED, init);

    expect(policy).toMatchObject({
      allowOrigin: LISTED,
      exposeHeaders: EXPOSED,
      vary: "Origin",
    });
  });

  it("serves the range itself to a listed origin", async () => {
    const { baseUrl } = await serve(LISTING_CONFIG);

    const policy = await corsPolicy(`${baseUrl}/data/orders.csv`, LISTED, {
      headers: { Range: "bytes=0-1" },
    });

    expect(policy.status).toBe(206);
  });

  it("refuses an unlisted loopback origin", async () => {
    const { baseUrl } = await serve(LISTING_CONFIG);

    const policy = await corsPolicy(`${baseUrl}/data/orders.csv`, UNLISTED);

    expect(policy).toEqual({
      status: 200,
      allowOrigin: null,
      exposeHeaders: null,
      vary: "Origin",
    });
  });

  it("answers a listed origin's preflight for a suffix range", async () => {
    const { baseUrl } = await serve(LISTING_CONFIG);

    const response = await fetch(`${baseUrl}/data/orders.csv`, {
      method: "OPTIONS",
      headers: {
        Origin: LISTED,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "range",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(LISTED);
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, HEAD",
    );
    expect(response.headers.get("access-control-allow-headers")).toBe("Range");
  });

  it("refuses every origin when none is listed", async () => {
    const { baseUrl } = await serve("export default {};\n");

    const policy = await corsPolicy(`${baseUrl}/data/orders.csv`, LISTED);

    expect(policy.allowOrigin).toBeNull();
  });

  it("gives a page and a module no CORS header, even for a listed loopback origin", async () => {
    const { baseUrl } = await serve(LISTING_CONFIG);

    const policies = await Promise.all(
      ["/", "/weekly", "/@vite/client"].map((path) =>
        corsPolicy(`${baseUrl}${path}`, LISTED),
      ),
    );

    expect(policies.map((policy) => policy.allowOrigin)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("applies an edited origin list on the next request, without a restart", async () => {
    const { root, baseUrl, dev } = await serve("export default {};\n");
    await waitForWatch(dev, root, "biac.config.ts");
    await corsPolicy(`${baseUrl}/data/orders.csv`, LISTED);

    writeFileSync(join(root, "biac.config.ts"), LISTING_CONFIG);

    await vi.waitFor(
      async () =>
        expect(
          (await corsPolicy(`${baseUrl}/data/orders.csv`, LISTED)).allowOrigin,
        ).toBe(LISTED),
      { timeout: WATCH_WAIT_MS },
    );
  });
});
