import {
  createServer,
  request as forward,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

/**
 * `target` with only the path and query of the request line's target. A
 * request line may carry an absolute URL, and a path may begin with `//`;
 * resolving either against `target` would let the request pick the upstream
 * host, so the host is always `target`'s. Null for a target that is neither a
 * path nor an absolute URL (such as `*`).
 */
function upstreamUrlFor(target: string, requestTarget: string): URL | null {
  const isPath = requestTarget.startsWith("/");
  if (!isPath && !URL.canParse(requestTarget)) return null;
  const parsed = isPath ? null : new URL(requestTarget);
  const pathAndQuery = parsed ? parsed.pathname + parsed.search : requestTarget;
  const queryAt = pathAndQuery.indexOf("?");
  const upstream = new URL(target);
  upstream.pathname =
    queryAt < 0 ? pathAndQuery : pathAndQuery.slice(0, queryAt);
  upstream.search = queryAt < 0 ? "" : pathAndQuery.slice(queryAt);
  return upstream;
}

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
      const upstreamUrl = upstreamUrlFor(target, incoming.url ?? "/");
      if (!upstreamUrl) return void response.writeHead(400).end();
      const upstream = forward(upstreamUrl, {
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
