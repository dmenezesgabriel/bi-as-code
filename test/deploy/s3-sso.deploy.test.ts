import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ComposeStack, startComposeStack } from "../lib/compose-stack.js";
import { type ExampleTokens, exampleTokens } from "../lib/keycloak-admin.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

const EXAMPLE_DIR = join(import.meta.dirname, "../../examples/s3-sso");
const BUCKET = "biac-site";
const UNSIGNED = `http://moto:5000/${BUCKET}`;
const SIGNED = `http://signer:8080/${BUCKET}`;
// Plain HTTP on the compose network, as oauth2-proxy reaches Keycloak.
const KEYCLOAK_HOST = "keycloak:8080";
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

// Reach Caddy from the probe as a browser reaches it: SNI and Host
// `localhost`.
const AS_BROWSER = [
  "-sk",
  "--connect-to",
  "localhost:8443:caddy:8443",
  "--connect-to",
  "localhost:8080:caddy:8080",
];

/** `curl` from the probe to the edge, resolving to `<body>\n<status>`. */
function atEdge(url: string, ...extra: string[]): Promise<string> {
  return stack.curlFrom("probe", [
    ...AS_BROWSER,
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

describe("the s3-sso identity provider", () => {
  const ISSUER = "https://localhost:8443/realms/biac";
  const BACK_CHANNEL = `http://${KEYCLOAK_HOST}/realms/biac`;
  const DISCOVERY = "/.well-known/openid-configuration";
  const AUTHORIZE =
    `${ISSUER}/protocol/openid-connect/auth?client_id=biac-dashboard` +
    "&response_type=code&scope=openid" +
    "&redirect_uri=https%3A%2F%2Flocalhost%3A8443%2Foauth2%2Fcallback";
  // RFC 7636 appendix B's verifier, hashed.
  const PKCE =
    "&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" +
    "&code_challenge_method=S256";

  it("names the edge as issuer when discovered through the edge", async () => {
    const discovery = JSON.parse(
      await stack.curlFrom("probe", [...AS_BROWSER, `${ISSUER}${DISCOVERY}`]),
    );

    expect(discovery.issuer).toBe(ISSUER);
  });

  it("names the same issuer on the back channel, with token and keys inside the network", async () => {
    const discovery = JSON.parse(
      await stack.curlFrom("probe", ["-s", `${BACK_CHANNEL}${DISCOVERY}`]),
    );

    expect(discovery).toMatchObject({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
      token_endpoint: `${BACK_CHANNEL}/protocol/openid-connect/token`,
      jwks_uri: `${BACK_CHANNEL}/protocol/openid-connect/certs`,
    });
  });

  it("refuses a sign-in without a PKCE challenge", async () => {
    const redirect = await stack.curlFrom("probe", [
      ...AS_BROWSER,
      "-o",
      "/dev/null",
      "-w",
      "%{http_code} %{redirect_url}",
      AUTHORIZE,
    ]);

    expect(redirect).toMatch(
      /^302 https:\/\/localhost:8443\/oauth2\/callback\?error=invalid_request&/,
    );
  });

  it("shows the sign-in form and its assets through the edge", async () => {
    const page = await atEdge(`${AUTHORIZE}${PKCE}`);
    const stylesheet = page.match(/href="(\/resources\/[^"]+\.css)"/)?.[1];

    expect(page).toMatch(/id="kc-form-login"[\s\S]*\n200$/);
    expect(await atEdge(`https://localhost:8443${stylesheet}`)).toMatch(
      /\n200$/,
    );
  });

  it("keeps the admin console off the edge", async () => {
    expect(await atEdge("https://localhost:8443/admin/master/console/")).toBe(
      "<p>missing</p>\n404",
    );
  });

  describe("the demo user's tokens", () => {
    let tokens: ExampleTokens;

    beforeAll(async () => {
      tokens = await exampleTokens(stack, {
        from: "probe",
        baseUrl: `http://${KEYCLOAK_HOST}`,
        realm: "biac",
        clientId: "biac-dashboard",
        username: "ada",
        admin: { username: "admin", password: "admin" },
      });
    });

    it("carry Entra's identity claims on the ID token", () => {
      expect(tokens.idToken).toMatchObject({
        iss: ISSUER,
        aud: "biac-dashboard",
        oid: tokens.userId,
        tid: "6d1f0c1e-3a5b-4c7d-9e2f-0a1b2c3d4e5f",
        preferred_username: "ada",
        roles: ["Dashboard.Viewer"],
      });
    });

    it("carry the app role where keycloak-oidc reads it on the access token", () => {
      expect(tokens.accessToken).toMatchObject({
        iss: ISSUER,
        aud: expect.arrayContaining(["biac-dashboard"]),
        roles: ["Dashboard.Viewer"],
        resource_access: { "biac-dashboard": { roles: ["Dashboard.Viewer"] } },
      });
    });

    // A realm import grants a user only the roles its file lists; without
    // the realm's default roles the account console refuses its own token.
    it("hold the realm's default roles, as a user Keycloak creates does", () => {
      expect(tokens.accessToken).toMatchObject({
        resource_access: {
          account: { roles: expect.arrayContaining(["manage-account"]) },
        },
      });
    });
  });
});

describe("the s3-sso network", () => {
  it.each(["moto", "signer", "keycloak"])(
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
