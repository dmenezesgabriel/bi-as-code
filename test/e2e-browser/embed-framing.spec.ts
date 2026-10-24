import type { Frame, Page } from "@playwright/test";
import type { AddressInfo } from "node:net";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { listOrigins } from "./embed-origins.js";
import { serveHostPage } from "./host-page.js";

const EMBED_PAGE = "embed-weekly-revenue";
// Chromium replaces a frame the browser refused with its error document.
const REFUSED_FRAME_URL = "chrome-error://chromewebdata/";

/**
 * The host page framing `src` across its width, sizing the frame from the
 * `biac:height` messages `src`'s origin posts — the listener the embedding
 * docs ask a host to write.
 */
function framedPage(src: string): string {
  const listener = `addEventListener("message", (event) => {
    if (event.origin !== "${new URL(src).origin}" || event.data?.type !== "biac:height") return;
    document.getElementById("f").height = event.data.height;
  });`;
  return `<style>body{margin:0}iframe{display:block;width:100%;border:0}</style><iframe id="f" src="${src}" height="600" scrolling="no"></iframe><script>${listener}</script>`;
}

/** Opens the host page at `hostOrigin` and returns its iframe. */
async function openFrame(page: Page, hostOrigin: string): Promise<Frame> {
  await page.goto(`${hostOrigin}/host.html`);
  const element = await page.locator("#f").elementHandle();
  return (await element!.contentFrame())!;
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
  const host = await serveHostPage(framedPage(src));
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
  const host = await serveHostPage(framedPage(`${biacDev.url}${EMBED_PAGE}`));
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
