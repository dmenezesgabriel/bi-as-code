import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ViteDevServer } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listenPagesServer,
  makePagesServer,
  waitForWatch,
} from "../lib/pages-vite-server.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

const ENDPOINT = "/__biac/page-source";
const PAGE_SOURCE = "---\ntitle: Weekly\n---\n# Weekly review\n";

let server: ViteDevServer | undefined;
let closeListener: (() => Promise<void>) | undefined;

afterEach(async () => {
  await closeListener?.();
  await server?.close();
  closeListener = undefined;
  server = undefined;
  cleanupProjects();
});

interface PageSourceSite {
  root: string;
  url: string;
  dev: ViteDevServer;
}

async function startSite(): Promise<PageSourceSite> {
  const root = makeTempProject("biac-page-source-");
  writeProjectFile(root, "pages/weekly.md", PAGE_SOURCE);
  writeProjectFile(root, "pages/notes.txt", "not a page\n");
  writeProjectFile(root, "secret.md", "# Outside pages\n");
  server = await makePagesServer(root);
  const listener = await listenPagesServer(server);
  closeListener = listener.close;
  return { root, url: `${listener.url}${ENDPOINT}`, dev: server };
}

function putSource(
  url: string,
  source: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ source }),
  });
}

describe("GET page source", () => {
  it("returns the page's bytes as uncached markdown", async () => {
    const site = await startSite();

    const res = await fetch(`${site.url}/weekly.md`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toBe(PAGE_SOURCE);
  });

  it("404s a missing page and a non-page file", async () => {
    const site = await startSite();

    const missing = await fetch(`${site.url}/nope.md`);
    const notPage = await fetch(`${site.url}/notes.txt`);

    expect([missing.status, notPage.status]).toEqual([404, 404]);
  });

  it("403s an encoded traversal outside pages/", async () => {
    const site = await startSite();

    const res = await fetch(`${site.url}/..%2Fsecret.md`);

    expect(res.status).toBe(403);
  });

  it("403s a read from another localhost origin", async () => {
    const site = await startSite();

    const res = await fetch(`${site.url}/weekly.md`, {
      headers: { Origin: "http://localhost:1" },
    });

    expect(res.status).toBe(403);
  });
});

describe("PUT page source", () => {
  it("writes the new source to disk and answers 204", async () => {
    const site = await startSite();

    const res = await putSource(`${site.url}/weekly.md`, "# Rewritten\n");

    expect(res.status).toBe(204);
    expect(readFileSync(join(site.root, "pages/weekly.md"), "utf8")).toBe(
      "# Rewritten\n",
    );
  });

  it("serves the written source back on the next GET", async () => {
    const site = await startSite();

    await putSource(`${site.url}/weekly.md`, "# Round trip\n");
    const res = await fetch(`${site.url}/weekly.md`);

    expect(await res.text()).toBe("# Round trip\n");
  });

  it("405s any other method and names the allowed ones", async () => {
    const site = await startSite();

    const res = await fetch(`${site.url}/weekly.md`, { method: "POST" });

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, PUT");
  });

  it("415s a body that is not JSON — a form post cannot write", async () => {
    const site = await startSite();

    const res = await fetch(`${site.url}/weekly.md`, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "# Plain\n",
    });

    expect(res.status).toBe(415);
    expect(readFileSync(join(site.root, "pages/weekly.md"), "utf8")).toBe(
      PAGE_SOURCE,
    );
  });

  it("400s a JSON body without a string source", async () => {
    const site = await startSite();

    const res = await fetch(`${site.url}/weekly.md`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "# Wrong key\n" }),
    });

    expect(res.status).toBe(400);
  });

  it("413s a body over 1 MiB and leaves the page untouched", async () => {
    const site = await startSite();

    const res = await putSource(`${site.url}/weekly.md`, "x".repeat(1 << 20));

    expect(res.status).toBe(413);
    expect(readFileSync(join(site.root, "pages/weekly.md"), "utf8")).toBe(
      PAGE_SOURCE,
    );
  });

  it("403s a write from a sibling localhost port (Sec-Fetch-Site: same-site)", async () => {
    const site = await startSite();

    const res = await putSource(`${site.url}/weekly.md`, "# Hijack\n", {
      "Sec-Fetch-Site": "same-site",
    });

    expect(res.status).toBe(403);
  });

  it("403s a write whose Origin is not the dev server", async () => {
    const site = await startSite();

    const res = await putSource(`${site.url}/weekly.md`, "# Hijack\n", {
      Origin: "http://localhost:1",
    });

    expect(res.status).toBe(403);
    expect(readFileSync(join(site.root, "pages/weekly.md"), "utf8")).toBe(
      PAGE_SOURCE,
    );
  });

  it("accepts a write carrying the dev server's own Origin", async () => {
    const site = await startSite();

    const res = await putSource(`${site.url}/weekly.md`, "# Same origin\n", {
      Origin: new URL(site.url).origin,
    });

    expect(res.status).toBe(204);
  });

  it("404s a write to a page that does not exist — no create", async () => {
    const site = await startSite();

    const res = await putSource(`${site.url}/new.md`, "# New\n");

    expect(res.status).toBe(404);
  });
});

describe("file watching", () => {
  it("reaches the watcher as exactly one change for the page", async () => {
    const site = await startSite();
    const pagesDir = join(site.root, "pages");
    const pageFile = join(pagesDir, "weekly.md");
    await waitForWatch(site.dev, pagesDir, "weekly.md");
    const events: string[] = [];
    site.dev.watcher.on("all", (event, path) =>
      events.push(`${event} ${path}`),
    );

    await putSource(`${site.url}/weekly.md`, "# Watched\n");
    // A later write is a fence: once its event arrives, every event the
    // PUT caused (including chokidar's delayed atomic unlinks) has too.
    writeProjectFile(site.root, "pages/fence.txt", "fence\n");
    await vi.waitFor(
      () => expect(events).toContain(`add ${join(pagesDir, "fence.txt")}`),
      { timeout: 10000 },
    );

    expect(events.filter((event) => event.endsWith(pageFile))).toEqual([
      `change ${pageFile}`,
    ]);
  });
});
