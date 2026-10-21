import type { Frame, Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { withEmbedOrigins } from "../lib/framing-policy.js";
import { rewriteUntilServerLogs } from "../lib/write-until-logged.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

const EMBED_PAGE = "embed-weekly-revenue";
// Chromium replaces a frame the browser refused with its error document.
const REFUSED_FRAME_URL = "chrome-error://chromewebdata/";

/**
 * A host page on its own loopback server framing `src` across its width,
 * sizing the frame from the `biac:height` messages `src`'s origin posts —
 * the listener the embedding docs ask a host to write. It must be a real
 * loopback origin: Chromium's Local Network Access checks refuse a page it
 * counts as public — a `page.route`-fulfilled `http://host.test` — framing
 * localhost (`net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`), which would
 * hide whether the CSP refused it.
 */
async function serveHostPage(src: string): Promise<Server> {
  const listener = `addEventListener("message", (event) => {
    if (event.origin !== "${new URL(src).origin}" || event.data?.type !== "biac:height") return;
    document.getElementById("f").height = event.data.height;
  });`;
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end(
      `<!doctype html><title>host</title><style>body{margin:0}iframe{display:block;width:100%;border:0}</style><iframe id="f" src="${src}" height="600" scrolling="no"></iframe><script>${listener}</script>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

/** Opens the host page at `hostOrigin` and returns its iframe. */
async function openFrame(page: Page, hostOrigin: string): Promise<Frame> {
  await page.goto(`${hostOrigin}/host.html`);
  const element = await page.locator("#f").elementHandle();
  return (await element!.contentFrame())!;
}

/** Rewrites the project's own config with `embed.origins` set to `origins`, until the server reports the edit. */
async function listOrigins(
  projectDir: string,
  log: () => readonly string[],
  origins: readonly string[],
): Promise<void> {
  const configFile = join(projectDir, "biac.config.ts");
  const config = readFileSync(configFile, "utf8");
  await rewriteUntilServerLogs({
    rewrite: () => writeFileSync(configFile, withEmbedOrigins(config, origins)),
    log,
    loggedPath: "biac.config.ts",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
}

/** The height the host page gave its frame. */
function frameHeight(page: Page): Promise<number> {
  return page.locator("#f").evaluate((frame) => frame.clientHeight);
}

/** Waits until the frame is exactly as tall as the framed document, so it shows all of it without a scrollbar. */
async function expectFrameFitsContent(page: Page, frame: Frame) {
  await expect
    .poll(async () => {
      const content = await frame.evaluate(
        () => document.documentElement.scrollHeight,
      );
      return content === (await frameHeight(page));
    })
    .toBe(true);
}

/** The part of Chromium's console error naming the `frame-ancestors` sources that refused a frame. */
function refusal(sources: string): string {
  return `violates the following Content Security Policy directive: "frame-ancestors ${sources}". The request has been blocked.`;
}

test("a page is framed only by an origin biac.config.ts lists", async ({
  page,
  biacDev,
}) => {
  const src = `${biacDev.url}${EMBED_PAGE}`;
  const host = await serveHostPage(src);
  const { port } = host.address() as AddressInfo;
  const listedHost = `http://localhost:${port}`;
  const unlistedHost = `http://127.0.0.1:${port}`;
  const errors = collectConsoleErrors(page);
  try {
    const byDefault = await openFrame(page, listedHost);
    await expect.poll(() => byDefault.url()).toBe(REFUSED_FRAME_URL);

    await listOrigins(biacDev.projectDir, biacDev.log, [listedHost]);
    const listed = await openFrame(page, listedHost);
    await expect(listed.getByText("Revenue by week")).toBeVisible();

    const unlisted = await openFrame(page, unlistedHost);
    await expect.poll(() => unlisted.url()).toBe(REFUSED_FRAME_URL);

    expect(errors).toEqual([
      expect.stringContaining(refusal("'none'")),
      expect.stringContaining(refusal(listedHost)),
    ]);
  } finally {
    host.close();
  }
});

test("a listed parent sizes its frame to the framed page's height", async ({
  page,
  biacDev,
}) => {
  const host = await serveHostPage(`${biacDev.url}${EMBED_PAGE}`);
  const { port } = host.address() as AddressInfo;
  const listedHost = `http://localhost:${port}`;
  await listOrigins(biacDev.projectDir, biacDev.log, [listedHost]);
  const errors = collectConsoleErrors(page);
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    const frame = await openFrame(page, listedHost);
    await expect(frame.getByText("Revenue by week")).toBeVisible();
    await expectFrameFitsContent(page, frame);
    const wide = await frameHeight(page);

    await page.setViewportSize({ width: 390, height: 900 });
    await expectFrameFitsContent(page, frame);
    const narrow = await frameHeight(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(() => frameHeight(page)).toBe(wide);
    expect(wide).toBeLessThan(600);
    expect(narrow).toBeGreaterThan(wide);
    expect(errors).toEqual([]);
  } finally {
    host.close();
  }
});
