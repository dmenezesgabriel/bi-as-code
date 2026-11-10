import {
  createServer,
  request as sendRequest,
  type IncomingMessage,
  type Server,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { StallingProxy } from "../e2e-browser/stalling-proxy.js";

/** An HTTP server that records the path of every request it answers. */
class RecordingServer {
  readonly paths: string[] = [];
  private readonly server: Server;

  constructor() {
    this.server = createServer((incoming: IncomingMessage, response) => {
      this.paths.push(incoming.url ?? "");
      response.end("ok");
    });
  }

  async listen(): Promise<string> {
    await new Promise<void>((done) => this.server.listen(0, "127.0.0.1", done));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/`;
  }

  async close(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise((done) => this.server.close(done));
  }
}

/** Sends `target` verbatim as the request line's target, as a forward proxy would see it. */
function requestThrough(proxyUrl: string, target: string): Promise<number> {
  const { hostname, port } = new URL(proxyUrl);
  return new Promise((resolve, reject) => {
    sendRequest({ hostname, port, path: target, method: "GET" }, (answer) => {
      answer.resume();
      resolve(answer.statusCode ?? 0);
    })
      .on("error", reject)
      .end();
  });
}

describe("StallingProxy", () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  async function proxyInFrontOf(): Promise<{
    proxyUrl: string;
    target: RecordingServer;
    other: RecordingServer;
    otherUrl: string;
  }> {
    const target = new RecordingServer();
    const other = new RecordingServer();
    const targetUrl = await target.listen();
    const otherUrl = await other.listen();
    const proxy = new StallingProxy(targetUrl, "/stalled");
    const proxyUrl = await proxy.listen();
    cleanups.push(
      () => proxy.close(),
      () => target.close(),
      () => other.close(),
    );
    return { proxyUrl, target, other, otherUrl };
  }

  it("pipes an ordinary request to the target", async () => {
    // Arrange
    const { proxyUrl, target } = await proxyInFrontOf();

    // Act
    const status = await requestThrough(proxyUrl, "/page?x=1");

    // Assert
    expect(status).toBe(200);
    expect(target.paths).toEqual(["/page?x=1"]);
  });

  it("keeps the target host when the request line names another host", async () => {
    // Arrange
    const { proxyUrl, target, other, otherUrl } = await proxyInFrontOf();

    // Act
    await requestThrough(proxyUrl, `${otherUrl}secret`);

    // Assert
    expect(other.paths).toEqual([]);
    expect(target.paths).toEqual(["/secret"]);
  });

  it("keeps the target host when the path starts with two slashes", async () => {
    // Arrange
    const { proxyUrl, target, other, otherUrl } = await proxyInFrontOf();
    const otherHost = new URL(otherUrl).host;

    // Act
    await requestThrough(proxyUrl, `//${otherHost}/secret`);

    // Assert
    expect(other.paths).toEqual([]);
    expect(target.paths).toEqual([`//${otherHost}/secret`]);
  });
});
