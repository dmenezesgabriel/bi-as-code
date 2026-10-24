import { rmSync } from "node:fs";
import { builtShippedProject } from "../lib/built-preview.js";
import { startBiacServer } from "../lib/dev-server.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { originOf, serveHostPage } from "./host-page.js";

// The module's default export mounts the widget; a refused cross-origin
// import rejects with TypeError — either way the page reports one word.
const HOST_PAGE = `<h1>Host page</h1><div id="widget"></div><pre id="status"></pre><script type="module">
const base = new URLSearchParams(location.search).get("biac");
try {
  const mod = await import(base + "widgets/revenue-by-region.js");
  mod.default(document.getElementById("widget"));
  document.getElementById("status").textContent = "mounted";
} catch (error) {
  document.getElementById("status").textContent = error.name;
}</script>`;

const CORS_REFUSAL = "has been blocked by CORS policy";

test("a listed host imports and mounts the exported widget module; an unlisted host's import is refused", async ({
  page,
}) => {
  const listed = await serveHostPage(HOST_PAGE);
  const unlisted = await serveHostPage(HOST_PAGE);
  const projectDir = builtShippedProject("biac-widget-module-", [
    originOf(listed),
  ]);
  const preview = await startBiacServer("preview", projectDir);
  const errors = collectConsoleErrors(page);
  // The module boots its own DuckDB against the publishing origin's /data/:
  // a data request addressed there — never the host's — is the proof.
  const dataReads: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(`${preview.url}data/`))
      dataReads.push(request.url());
  });
  try {
    await page.goto(
      `${originOf(listed)}/host.html?biac=${encodeURIComponent(preview.url)}`,
    );
    await expect(page.locator("#status")).toHaveText("mounted");
    const mounted = await page.locator("#widget").evaluate((el) => ({
      shadow: el.shadowRoot !== null,
      canvases: el.shadowRoot?.querySelectorAll("canvas").length ?? 0,
      text: el.shadowRoot?.textContent ?? "",
    }));
    expect(mounted.shadow).toBe(true);
    expect(mounted.text).toContain("Revenue by region");
    // The chart's canvas only appears once its query has run.
    await expect
      .poll(async () => {
        const { canvases } = await page.locator("#widget").evaluate((el) => ({
          canvases: el.shadowRoot?.querySelectorAll("canvas").length ?? 0,
        }));
        return canvases;
      })
      .toBe(1);
    // The host page's own styles are untouched: a preflight leak would
    // zero the h1's default margin.
    const hostMargin = await page
      .locator("h1")
      .evaluate((el) => getComputedStyle(el).marginBlockStart);
    expect(hostMargin).not.toBe("0px");
    expect(dataReads.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);

    await page.goto(
      `${originOf(unlisted)}/host.html?biac=${encodeURIComponent(preview.url)}`,
    );
    await expect(page.locator("#status")).toHaveText("TypeError");
    expect(errors.some((error) => error.includes(CORS_REFUSAL))).toBe(true);
    expect(
      errors.every(
        (error) =>
          error.includes(CORS_REFUSAL) || error.includes("net::ERR_FAILED"),
      ),
    ).toBe(true);
  } finally {
    await preview.stop();
    listed.close();
    unlisted.close();
    rmSync(projectDir, { recursive: true, force: true });
  }
});
