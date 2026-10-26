// Proves the running example from the outside, as a viewer and an attacker
// on the network would meet it: no session is sent to sign in, the bucket
// refuses unsigned reads, and a signed-in browser renders, filters, reloads
// and deep-links the real build. `smoke.sh` brings the stack up around it.
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  type APIRequestContext,
  type Locator,
  type Page,
  chromium,
  expect,
  request,
} from "@playwright/test";

const EDGE = "https://localhost:8443";
const COMPOSE_FILE = join(import.meta.dirname, "compose.yaml");
// The realm's demo user holding the app role (keycloak/realm.json).
const USERNAME = "ada";
// eslint-disable-next-line sonarjs/no-hardcoded-passwords -- the published demo credential in keycloak/realm.json; it guards nothing outside a local compose network
const PASSWORD = "biac-demo";
// Opened before signing in: the viewer must land back on it, query intact.
const DEEP_LINK = "/weekly-review/?region=West";
// The first render fetches DuckDB's wasm (34 MB) through the TLS edge and
// the signer before any query answers — far past `expect`'s 5 s default.
const FIRST_RENDER_TIMEOUT_MS = 60_000;

const run = promisify(execFile);

function step(done: string): void {
  console.log(`ok — ${done}`);
}

/** Fails with the value seen and the one expected. */
function expectValue(what: string, actual: string, expected: string): void {
  if (actual === expected) return;
  throw new Error(
    `${what}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  );
}

async function checkNoSessionIsSentToSignIn(
  edge: APIRequestContext,
): Promise<void> {
  const https = await edge.get(`${EDGE}/weekly-review/`, { maxRedirects: 0 });
  expectValue("no-session status", String(https.status()), "302");
  expectValue(
    "no-session location",
    https.headers()["location"] ?? "",
    "/oauth2/sign_in?rd=%2Fweekly-review%2F",
  );
  const http = await edge.get("http://localhost:8080/weekly-review/", {
    maxRedirects: 0,
  });
  expectValue("plain HTTP status", String(http.status()), "308");
  expectValue(
    "plain HTTP location",
    http.headers()["location"] ?? "",
    `${EDGE}/weekly-review/`,
  );
  step("no session → 302 to sign-in; HTTP → 308 to HTTPS");
}

async function checkBucketRefusesUnsignedReads(): Promise<void> {
  const { stdout } = await run("docker", [
    "compose",
    "-f",
    COMPOSE_FILE,
    "exec",
    "-T",
    "probe",
    "curl",
    "-s",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- moto's plain-HTTP endpoint on the private compose network, read unsigned on purpose to prove it refuses
    "http://moto:5000/biac-site/index.html",
  ]);
  expectValue("unsigned bucket read", stdout, "403");
  step("unsigned read of the bucket → 403");
}

/** Records every data-file status the page receives, in arrival order. */
function watchDataReads(page: Page): string[] {
  const reads: string[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.startsWith("/data/")) {
      reads.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  return reads;
}

function watchConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function signIn(page: Page): Promise<void> {
  await page.goto(`${EDGE}${DEEP_LINK}`);
  await page.locator("#username").fill(USERNAME);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("#kc-login").click();
  await page.waitForURL(`${EDGE}${DEEP_LINK}`);
  step(`signed in as ${USERNAME} at Keycloak, back on ${DEEP_LINK}`);
}

function matchCount(page: Page): Locator {
  return page.getByRole("status").filter({ hasText: /match/ });
}

async function checkPageRendersFromTheBucket(
  page: Page,
  dataReads: string[],
): Promise<void> {
  const started = performance.now();
  await expect(matchCount(page)).toHaveText("140 matches", {
    timeout: FIRST_RENDER_TIMEOUT_MS,
  });
  const renderedMs = Math.round(performance.now() - started);
  const refused = dataReads.filter((read) => !read.startsWith("200 "));
  if (dataReads.length === 0 || refused.length > 0) {
    throw new Error(
      `data reads through the edge: got ${JSON.stringify(dataReads)}, expected at least one, every one 200`,
    );
  }
  step(
    `weekly-review renders 140 matches ${renderedMs} ms after sign-in; data reads ${dataReads.join(", ")}`,
  );
}

async function checkFilterRequeries(page: Page): Promise<void> {
  await page.getByRole("combobox", { name: "Region" }).click();
  await page.getByRole("option", { name: "North" }).click();
  await expect(matchCount(page)).toHaveText("120 matches");
  await expect(page).toHaveURL(`${EDGE}/weekly-review/?region=North`);
  step("Region → North re-queries to 120 matches");
}

async function checkReloadKeepsThePage(page: Page): Promise<void> {
  await page.reload();
  await expect(page).toHaveURL(`${EDGE}/weekly-review/?region=North`);
  await expect(matchCount(page)).toHaveText("120 matches");
  step("reload keeps /weekly-review/?region=North and its 120 matches");
}

async function checkDeepLinkRenders(page: Page): Promise<void> {
  const response = await page.goto(`${EDGE}/nested/allocation/`);
  expectValue("deep link status", String(response?.status()), "200");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  step("/nested/allocation/ opened directly → 200, heading rendered");
}

async function checkSignedInBrowser(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await (
      await browser.newContext({ ignoreHTTPSErrors: true })
    ).newPage();
    const errors = watchConsoleErrors(page);
    const dataReads = watchDataReads(page);
    await signIn(page);
    await checkPageRendersFromTheBucket(page, dataReads);
    await checkFilterRequeries(page);
    await checkReloadKeepsThePage(page);
    await checkDeepLinkRenders(page);
    expectValue("console errors", JSON.stringify(errors), "[]");
    step("console clean");
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const edge = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    await checkNoSessionIsSentToSignIn(edge);
  } finally {
    await edge.dispose();
  }
  await checkBucketRefusesUnsignedReads();
  await checkSignedInBrowser();
}

await main();
