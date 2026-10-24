import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * The host page a widget-module spec serves: it imports the module named by
 * the `?biac=` parameter and mounts its default export into `#widget`,
 * reporting one word in `#status` — "mounted", or the error's name when the
 * import rejects (a refused cross-origin import is a TypeError). `?biac=`
 * is whatever precedes `widgets/` in the module's URL: a full origin on a
 * cross-origin host, or an absolute path like `/bi-as-code/` when the page
 * shares the publishing server's origin.
 */
export const WIDGET_HOST_PAGE = `<h1>Host page</h1><div id="widget"></div><pre id="status"></pre><script type="module">
const base = new URLSearchParams(location.search).get("biac");
try {
  const mod = await import(base + "widgets/revenue-by-region.js");
  mod.default(document.getElementById("widget"));
  document.getElementById("status").textContent = "mounted";
} catch (error) {
  document.getElementById("status").textContent = error.name;
}</script>`;

/**
 * A host page on its own `127.0.0.1` server, serving `html` as
 * `/host.html` — the second origin a cross-origin spec drives. It must be
 * a real loopback origin: Chromium's Local Network Access checks refuse a
 * page it counts as public reaching localhost, which would hide whether
 * the policy under test refused it.
 *
 * @example
 * const host = await serveHostPage(`<iframe src="${src}"></iframe>`);
 * await page.goto(`${originOf(host)}/host.html`);
 */
export async function serveHostPage(html: string): Promise<Server> {
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end(`<!doctype html><title>host</title>${html}`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

/** The host server's origin, e.g. `"http://127.0.0.1:50123"`. */
export function originOf(server: Server): string {
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
