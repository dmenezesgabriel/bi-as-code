import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ComposeStack, startComposeStack } from "../lib/compose-stack.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

const EXAMPLE_DIR = join(import.meta.dirname, "../../examples/s3-sso");
const BUCKET = "biac-site";
const UNSIGNED = `http://moto:5000/${BUCKET}`;
const SIGNED = `http://signer:8080/${BUCKET}`;
const PARQUET_BYTES = Buffer.from("PAR1-fixture-bytes-PAR1");

// One file per extension `biac build` emits, so every content-type mapping
// in the Terraform is read back from the bucket.
const SITE_FILES: Record<string, { body: string | Buffer; type: string }> = {
  "index.html": { body: "<p>home</p>", type: "text/html; charset=utf-8" },
  "404.html": { body: "<p>missing</p>", type: "text/html; charset=utf-8" },
  "weekly-review/index.html": {
    body: "<p>weekly</p>",
    type: "text/html; charset=utf-8",
  },
  "assets/app.js": { body: "1;", type: "text/javascript; charset=utf-8" },
  "assets/app.css": { body: "p{}", type: "text/css; charset=utf-8" },
  "assets/icon.svg": { body: "<svg/>", type: "image/svg+xml" },
  "assets/duckdb.wasm": { body: "\0asm", type: "application/wasm" },
  "data/orders.csv": { body: "id\n1\n", type: "text/csv; charset=utf-8" },
  "data/orders.parquet": {
    body: PARQUET_BYTES,
    type: "application/vnd.apache.parquet",
  },
};

let stack: ComposeStack;

/** `curl` from the probe, printing only `<status> <content-type>`. */
function statusOf(url: string, ...extra: string[]): Promise<string> {
  return stack.curlFrom("probe", [
    "-s",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code} %{content_type}",
    ...extra,
    url,
  ]);
}

/**
 * `curl` from the probe to Caddy as a browser would reach it — SNI and Host
 * `localhost` — resolving to `<body>\n<status>`.
 */
function atEdge(url: string, ...extra: string[]): Promise<string> {
  return stack.curlFrom("probe", [
    "-sk",
    "--connect-to",
    "localhost:8443:caddy:8443",
    "--connect-to",
    "localhost:8080:caddy:8080",
    "-w",
    "\n%{http_code}",
    ...extra,
    url,
  ]);
}

beforeAll(async () => {
  const site = makeTempProject("biac-s3-sso-");
  for (const [path, file] of Object.entries(SITE_FILES)) {
    writeProjectFile(site, path, file.body);
  }
  stack = await startComposeStack({
    dir: EXAMPLE_DIR,
    environment: { BIAC_SITE_DIR: site },
    profiles: ["probe"],
  });
});

afterAll(async () => {
  await stack?.down();
  cleanupProjects();
});

describe("the s3-sso bucket", () => {
  it("refuses an unsigned read", async () => {
    expect(await statusOf(`${UNSIGNED}/index.html`)).toMatch(/^403 /);
  });

  it.each(Object.entries(SITE_FILES))(
    "serves %s through the signer with its content type",
    async (path, file) => {
      expect(await statusOf(`${SIGNED}/${path}`)).toBe(`200 ${file.type}`);
    },
  );

  it("answers a ranged data read with 206 and the object's length", async () => {
    const headers = await stack.curlFrom("probe", [
      "-s",
      "-D",
      "-",
      "-o",
      "/dev/null",
      "-H",
      "Range: bytes=0-3",
      `${SIGNED}/data/orders.parquet`,
    ]);

    expect(headers).toMatch(/^HTTP\/1\.1 206/);
    expect(headers).toContain(
      `Content-Range: bytes 0-3/${PARQUET_BYTES.length}`,
    );
  });

  it("answers a missing key with 404", async () => {
    expect(await statusOf(`${SIGNED}/nope.html`)).toMatch(/^404 /);
  });

  it("refuses a write with the reader's key", async () => {
    expect(
      await statusOf(`${SIGNED}/evil.html`, "-X", "PUT", "--data", "x"),
    ).toMatch(/^403 /);
  });
});

describe("the s3-sso edge", () => {
  const EDGE = "https://localhost:8443";

  it.each([
    ["/", "<p>home</p>\n200"],
    ["/weekly-review/", "<p>weekly</p>\n200"],
    ["/weekly-review/?region=West", "<p>weekly</p>\n200"],
  ])("serves the route directory %s its index.html", async (path, answer) => {
    expect(await atEdge(`${EDGE}${path}`)).toBe(answer);
  });

  it.each(["/nope/", "/nope.html"])(
    "answers the miss %s with 404.html and status 404",
    async (path) => {
      expect(await atEdge(`${EDGE}${path}`)).toBe("<p>missing</p>\n404");
    },
  );

  it("answers a ranged data read with 206 and the object's length", async () => {
    const headers = await atEdge(
      `${EDGE}/data/orders.parquet`,
      "-D",
      "-",
      "-o",
      "/dev/null",
      "-H",
      "Range: bytes=0-3",
    );

    expect(headers).toMatch(/^HTTP\/2 206/);
    expect(headers).toMatch(
      new RegExp(`content-range: bytes 0-3/${PARQUET_BYTES.length}`, "i"),
    );
  });

  it("redirects plain HTTP to the HTTPS port", async () => {
    const headers = await atEdge(
      "http://localhost:8080/weekly-review/",
      "-D",
      "-",
      "-o",
      "/dev/null",
    );

    expect(headers).toMatch(/^HTTP\/1\.1 30[18]/);
    expect(headers).toMatch(
      /location: https:\/\/localhost:8443\/weekly-review\/\r?\n/i,
    );
  });
});

describe("the s3-sso network", () => {
  it.each(["moto", "signer"])(
    "publishes no host port for %s",
    async (service) => {
      expect(await stack.publishedPorts(service)).toEqual([]);
    },
  );

  it("publishes Caddy's two ports on loopback only", async () => {
    expect((await stack.publishedPorts("caddy")).sort()).toEqual([
      "127.0.0.1:8080->8080/tcp",
      "127.0.0.1:8443->8443/tcp",
    ]);
  });
});
