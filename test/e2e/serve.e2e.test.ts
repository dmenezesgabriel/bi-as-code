import { spawnSync } from "node:child_process";
import {
  chmodSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  buildCli,
  buildProject,
  startBiacServer,
  type DevServer,
} from "../lib/dev-server.js";
import { copyShippedProject } from "../lib/shipped-project.js";
import { cleanupProjects, makeTempProject } from "../lib/temp-project.js";

const biac = fileURLToPath(new URL("../../bin/biac", import.meta.url));
const USER = "viewer";
const PASSWORD = "s3cret";
const CREDENTIALS: NodeJS.ProcessEnv = {
  BIAC_BASIC_USER: USER,
  BIAC_BASIC_PASSWORD: PASSWORD,
  BIAC_AUTH_DISABLED: undefined,
};
// A developer's own shell may export these; every case states its own.
const NO_AUTH_ENV: NodeJS.ProcessEnv = {
  BIAC_BASIC_USER: undefined,
  BIAC_BASIC_PASSWORD: undefined,
  BIAC_AUTH_DISABLED: undefined,
};
function basicAuthHeader(user: string, password: string): string {
  const encoded = Buffer.from(`${user}:${password}`).toString("base64");
  return `Basic ${encoded}`;
}

const AUTHORIZED = { Authorization: basicAuthHeader(USER, PASSWORD) };

let root: string;
let server: DevServer | undefined;

beforeAll(() => {
  // The e2e exercises the shipped artifact: bin/biac runs dist/cli, never src.
  buildCli();
  root = makeTempProject("biac-e2e-serve-");
  copyShippedProject(root);
  buildProject(root);
}, 240_000);

afterEach(() => {
  server?.kill();
  server = undefined;
});

afterAll(() => {
  cleanupProjects();
});

function startServe(
  environment: NodeJS.ProcessEnv,
  extraArguments: readonly string[] = [],
): Promise<DevServer> {
  return startBiacServer("serve", root, environment, extraArguments);
}

function getAuthorized(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    redirect: "manual",
    headers: { ...AUTHORIZED, ...init.headers },
  });
}

function runServe(
  environment: NodeJS.ProcessEnv,
  extraArguments: readonly string[],
): { status: number | null; stderr: string } {
  const run = spawnSync(
    process.execPath,
    [biac, "serve", root, "--port", "0", ...extraArguments],
    {
      encoding: "utf8",
      env: { ...process.env, ...environment },
      timeout: 20_000,
    },
  );
  return { status: run.status, stderr: run.stderr };
}

describe("biac serve credentials", () => {
  it("answers 401 with the challenge and the hardened headers without credentials", async () => {
    server = await startServe(CREDENTIALS);

    const response = await fetch(`${server.url}weekly-review/`);

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Basic realm="biac", charset="UTF-8"',
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  }, 60_000);

  it("answers 401 for a wrong password and 200 for the right pair", async () => {
    server = await startServe(CREDENTIALS);
    const wrong = basicAuthHeader(USER, "nope");

    const rejected = await fetch(`${server.url}weekly-review/`, {
      headers: { Authorization: wrong },
    });
    const accepted = await getAuthorized(`${server.url}weekly-review/`);

    expect(rejected.status).toBe(401);
    expect(accepted.status).toBe(200);
  }, 60_000);

  it("keeps the hardened headers on a 200 and on its 304", async () => {
    server = await startServe(CREDENTIALS);
    const url = `${server.url}weekly-review/`;

    const first = await getAuthorized(url);
    const revalidated = await getAuthorized(url, {
      headers: { "If-None-Match": first.headers.get("etag") ?? "" },
    });

    expect(revalidated.status).toBe(304);
    for (const response of [first, revalidated]) {
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
    }
  }, 60_000);

  it("stops on SIGINT with exit code 0", async () => {
    server = await startServe(CREDENTIALS);

    expect(await server.stop()).toBe(0);
  }, 60_000);
});

describe("biac serve static contract", () => {
  it("caches hashed assets as immutable and nothing else", async () => {
    server = await startServe(CREDENTIALS);
    const assetPath = readFileSync(
      join(root, "build", "index.html"),
      "utf8",
    ).match(/\/assets\/[^"']+\.js/)?.[0];
    expect(assetPath).toBeDefined();

    const asset = await getAuthorized(`${server.url}${assetPath!.slice(1)}`);
    const page = await getAuthorized(`${server.url}weekly-review/`);

    expect(asset.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(asset.headers.get("content-type")).toMatch(/javascript/);
    expect(page.headers.get("cache-control")).not.toContain("immutable");
  }, 60_000);

  it("reads parquet by byte range", async () => {
    server = await startServe(CREDENTIALS);
    const parquet = join(root, "build", "data", "flights.parquet");

    const ranged = await getAuthorized(`${server.url}data/flights.parquet`, {
      headers: { Range: "bytes=0-3" },
    });

    expect(ranged.status).toBe(206);
    expect(ranged.headers.get("content-type")).toBe(
      "application/vnd.apache.parquet",
    );
    expect(ranged.headers.get("content-range")).toBe(
      `bytes 0-3/${statSync(parquet).size}`,
    );
    expect(await ranged.text()).toBe("PAR1");
  }, 60_000);

  it.each([
    [".wasm", "application/wasm"],
    [".css", "text/css"],
  ])(
    "types a built %s asset as %s",
    async (extension, mediaType) => {
      server = await startServe(CREDENTIALS);
      const asset = readdirSync(join(root, "build", "assets")).find((name) =>
        name.endsWith(extension),
      );
      expect(asset).toBeDefined();

      const response = await getAuthorized(`${server.url}assets/${asset!}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(
        new RegExp(`^${mediaType}`),
      );
    },
    60_000,
  );

  it("serves a route's own index.html and redirects the slash-less form, keeping the query", async () => {
    server = await startServe(CREDENTIALS);

    const deepLink = await getAuthorized(`${server.url}weekly-review/`);
    const redirect = await getAuthorized(
      `${server.url}weekly-review?region=West`,
    );

    expect(deepLink.status).toBe(200);
    expect(deepLink.headers.get("content-type")).toMatch(/^text\/html/);
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get("location")).toBe(
      "/weekly-review/?region=West",
    );
  }, 60_000);

  it("answers an unknown route 404 with the build's 404.html, and a missing data file 404", async () => {
    server = await startServe(CREDENTIALS);
    const notFoundPage = readFileSync(join(root, "build", "404.html"), "utf8");

    const unknown = await getAuthorized(`${server.url}nope`);
    const missingData = await getAuthorized(`${server.url}data/nope.parquet`);

    expect(unknown.status).toBe(404);
    expect(await unknown.text()).toBe(notFoundPage);
    expect(missingData.status).toBe(404);
  }, 60_000);
});

describe("biac serve boot guard", () => {
  it("refuses a public bind with no credentials, naming all three variables", () => {
    const run = runServe(NO_AUTH_ENV, ["--host", "0.0.0.0"]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("BIAC_BASIC_USER");
    expect(run.stderr).toContain("BIAC_BASIC_PASSWORD");
    expect(run.stderr).toContain("BIAC_AUTH_DISABLED");
  }, 30_000);

  it("still refuses when BIAC_AUTH_DISABLED is anything but 1 or true", () => {
    const run = runServe({ ...NO_AUTH_ENV, BIAC_AUTH_DISABLED: "yes" }, [
      "--host",
      "0.0.0.0",
    ]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("BIAC_AUTH_DISABLED");
  }, 30_000);

  it("starts a public bind with auth disabled, and warns loudly", async () => {
    server = await startServe({ ...NO_AUTH_ENV, BIAC_AUTH_DISABLED: "true" }, [
      "--host",
      "0.0.0.0",
    ]);

    const open = await fetch(`${server.url}weekly-review/`);

    expect(open.status).toBe(200);
    expect(server.log().join("\n")).toContain(
      "WARNING: authentication is disabled (BIAC_AUTH_DISABLED)",
    );
  }, 60_000);

  it("warns that a half-set pair enforces nothing, and serves openly on loopback", async () => {
    server = await startServe({ ...NO_AUTH_ENV, BIAC_BASIC_USER: USER });

    const open = await fetch(`${server.url}weekly-review/`);

    expect(open.status).toBe(200);
    expect(server.log().join("\n")).toContain(
      "BIAC_BASIC_PASSWORD is missing, so basic auth is not enforced",
    );
  }, 60_000);
});

describe("biac serve on a read-only project", () => {
  // `chmod` stands in for a container's read-only root filesystem. The
  // package.json makes the project an ES module like the image's `/app`,
  // which is the case where a bundling config loader writes a temp file.
  function setProjectWritable(writable: boolean): void {
    const entries = readdirSync(root, { recursive: true, encoding: "utf8" });
    for (const path of [root, ...entries.map((entry) => join(root, entry))]) {
      const { mode } = statSync(path);
      chmodSync(path, writable ? mode | 0o200 : mode & ~0o222);
    }
  }

  it("boots and serves a page when nothing in the project can be written", async () => {
    writeFileSync(join(root, "package.json"), '{ "type": "module" }\n');
    setProjectWritable(false);
    try {
      server = await startServe(CREDENTIALS);

      const response = await getAuthorized(`${server.url}weekly-review/`);

      expect(response.status).toBe(200);
    } finally {
      setProjectWritable(true);
      rmSync(join(root, "package.json"));
    }
  }, 60_000);
});
