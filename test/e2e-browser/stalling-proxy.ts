import {
  createServer,
  request as forward,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

/**
 * An HTTP proxy in front of a running dev server that never answers one path
 * — a server-side hang on demand, since `biac dev` has no hook a project can
 * stall a request through. Every other request is piped to `target`.
 *
 * @example
 * const proxy = new StallingProxy(biacDev.url, "/src/main.tsx");
 * await page.goto(`${await proxy.listen()}weekly-review`);
 * await proxy.close();
 */
export class StallingProxy {
  private readonly server: Server;
  private readonly held: ServerResponse[] = [];

  constructor(target: string, stalledPath: string) {
    this.server = createServer((incoming, response) => {
      if (incoming.url?.split("?")[0] === stalledPath) {
        return void this.held.push(response);
      }
      const upstream = forward(new URL(incoming.url ?? "/", target), {
        method: incoming.method,
        headers: incoming.headers,
      });
      // A browser that cancels, or a dev server stopped mid-answer, ends
      // the pair instead of throwing "socket hang up" into the test.
      upstream.on("error", () => response.destroy());
      response.on("close", () => upstream.destroy());
      upstream.on("response", (answer) => {
        response.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(response);
      });
      incoming.pipe(upstream);
    });
  }

  /** Binds an ephemeral port; resolves with its base URL, trailing slash. */
  async listen(): Promise<string> {
    await new Promise<void>((done) => this.server.listen(0, done));
    return `http://localhost:${(this.server.address() as AddressInfo).port}/`;
  }

  async close(): Promise<void> {
    for (const response of this.held) response.destroy();
    this.server.closeAllConnections();
    await new Promise((done) => this.server.close(done));
  }
}
