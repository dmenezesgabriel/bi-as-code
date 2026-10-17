import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

// Every run appends one line to runs.log under the project root (the
// loader's cwd), so the log counts how many processes a request spawned.
const LOADER_OUTPUT = "id,amount\n1,10\n2,20\n";
const COUNTING_LOADER = `
import { appendFileSync } from "node:fs";
appendFileSync("runs.log", "run\\n");
process.stdout.write(${JSON.stringify(LOADER_OUTPUT)});
`;

function loaderRuns(): number {
  const log = join(projectRoot!, "runs.log");
  return existsSync(log) ? readFileSync(log, "utf8").split("\n").length - 1 : 0;
}

describe("/data/ loader output", () => {
  it("serves a loader's stdout at the path it generates", async () => {
    await serve();
    writeFile("data/gen.csv.js", COUNTING_LOADER);

    const res = await fetch(`${baseUrl}/data/gen.csv`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv");
    expect(res.headers.get("content-length")).toBe(
      String(LOADER_OUTPUT.length),
    );
    expect(await res.text()).toBe(LOADER_OUTPUT);
  });

  it("serves a byte range of the output", async () => {
    await serve();
    writeFile("data/gen.csv.js", COUNTING_LOADER);

    const res = await fetch(`${baseUrl}/data/gen.csv`, {
      headers: { range: "bytes=0-3" },
    });

    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(
      `bytes 0-3/${LOADER_OUTPUT.length}`,
    );
    expect(await res.text()).toBe(LOADER_OUTPUT.slice(0, 4));
  });

  it("answers HEAD on the output with its length and no body", async () => {
    await serve();
    writeFile("data/gen.csv.js", COUNTING_LOADER);

    const res = await fetch(`${baseUrl}/data/gen.csv`, { method: "HEAD" });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe(
      String(LOADER_OUTPUT.length),
    );
    expect(await res.text()).toBe("");
  });

  it("runs the loader once for concurrent ranged requests", async () => {
    await serve();
    writeFile("data/gen.csv.js", COUNTING_LOADER);

    const responses = await Promise.all(
      ["bytes=0-3", "bytes=4-7", "bytes=8-"].map((range) =>
        fetch(`${baseUrl}/data/gen.csv`, { headers: { range } }),
      ),
    );

    expect(responses.map((res) => res.status)).toEqual([206, 206, 206]);
    expect(loaderRuns()).toBe(1);
  });

  it("serves a static file over the loader beside it", async () => {
    await serve();
    writeFile("data/gen.csv", CSV);
    writeFile("data/gen.csv.js", COUNTING_LOADER);

    const res = await fetch(`${baseUrl}/data/gen.csv`);

    expect(await res.text()).toBe(CSV);
    expect(loaderRuns()).toBe(0);
  });

  it("404s the loader source", async () => {
    await serve();
    writeFile("data/gen.csv.js", COUNTING_LOADER);

    const res = await fetch(`${baseUrl}/data/gen.csv.js`);

    expect(res.status).toBe(404);
  });

  it("404s the loader source after its output was generated", async () => {
    await serve();
    writeFile("data/gen.csv.js", COUNTING_LOADER);
    await (await fetch(`${baseUrl}/data/gen.csv`)).text();

    const res = await fetch(`${baseUrl}/data/gen.csv.js`);

    expect(res.status).toBe(404);
  });

  it("404s a helper module a loader imports", async () => {
    await serve();
    writeFile("data/lib/util.js", "export const secret = 1;\n");

    const res = await fetch(`${baseUrl}/data/lib/util.js`);

    expect(res.status).toBe(404);
  });

  it("404s a helper module's extensionless path without running it", async () => {
    await serve();
    writeFile("data/lib/util.js", COUNTING_LOADER);

    const res = await fetch(`${baseUrl}/data/lib/util`);

    expect(res.status).toBe(404);
    expect(loaderRuns()).toBe(0);
  });

  it("answers a failing loader with a plain-text 500 naming it and its exit code", async () => {
    await serve();
    writeFile(
      "data/bad.csv.js",
      'process.stderr.write("boom\\n");\nprocess.exit(3);\n',
    );

    const res = await fetch(`${baseUrl}/data/bad.csv`);

    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe(
      "data loader data/bad.csv.js exited with code 3, expected 0; stderr:\nboom",
    );
  });
});
