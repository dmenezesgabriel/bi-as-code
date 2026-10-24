import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

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
