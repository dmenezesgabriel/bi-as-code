import type { ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import {
  listenPagesServer,
  makePagesServer,
} from "../lib/pages-vite-server.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

const CSV = "id,region,amount\n1,West,10\n2,East,20\n";
const PARQUET_STUB = Buffer.from([0x50, 0x41, 0x52, 0x31, 0xde, 0xad]);

let projectRoot: string | undefined;
let server: ViteDevServer | undefined;
let closeHttp: (() => Promise<void>) | undefined;
let baseUrl = "";

afterEach(async () => {
  await closeHttp?.();
  closeHttp = undefined;
  await server?.close();
  server = undefined;
  cleanupProjects();
});

async function serve(): Promise<void> {
  projectRoot = makeTempProject();
  server = await makePagesServer(projectRoot);
  const http = await listenPagesServer(server);
  baseUrl = http.url;
  closeHttp = http.close;
}

function writeFile(relativePath: string, content: string | Buffer): void {
  writeProjectFile(projectRoot!, relativePath, content);
}

describe("/data/ serving", () => {
  it("serves a csv file with its type, length and no-cache dev headers", async () => {
    await serve();
    writeFile("data/orders.csv", CSV);

    const res = await fetch(`${baseUrl}/data/orders.csv`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv");
    expect(res.headers.get("content-length")).toBe(String(CSV.length));
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(await res.text()).toBe(CSV);
  });

  it("serves files in nested directories", async () => {
    await serve();
    writeFile("data/sub/nested.parquet", PARQUET_STUB);

    const res = await fetch(`${baseUrl}/data/sub/nested.parquet`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PARQUET_STUB);
  });

  it("404s a missing file", async () => {
    await serve();

    const res = await fetch(`${baseUrl}/data/missing.csv`);

    expect(res.status).toBe(404);
  });

  it("404s the data directory itself", async () => {
    await serve();
    writeFile("data/orders.csv", CSV);

    const res = await fetch(`${baseUrl}/data/`);

    expect(res.status).toBe(404);
  });

  it("403s an encoded traversal outside data/", async () => {
    await serve();
    writeFile("biac.config.ts", "export default {};\n");

    // fetch normalizes unencoded `..` client-side — %2e%2e%2f is the real vector.
    const res = await fetch(`${baseUrl}/data/%2e%2e%2fbiac.config.ts`);

    expect(res.status).toBe(403);
  });

  it("serves a byte range with a Content-Range header", async () => {
    await serve();
    writeFile("data/orders.csv", CSV);

    const res = await fetch(`${baseUrl}/data/orders.csv`, {
      headers: { range: "bytes=2-5" },
    });

    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 2-5/${CSV.length}`);
    expect(await res.text()).toBe(CSV.slice(2, 6));
  });

  it("416s an unsatisfiable range", async () => {
    await serve();
    writeFile("data/orders.csv", CSV);

    const res = await fetch(`${baseUrl}/data/orders.csv`, {
      headers: { range: `bytes=${CSV.length + 10}-` },
    });

    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe(`bytes */${CSV.length}`);
  });

  it("answers HEAD with the same headers and no body", async () => {
    await serve();
    writeFile("data/orders.csv", CSV);

    const res = await fetch(`${baseUrl}/data/orders.csv`, { method: "HEAD" });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe(String(CSV.length));
    expect(await res.text()).toBe("");
  });
});
