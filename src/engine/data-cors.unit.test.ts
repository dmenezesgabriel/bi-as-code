import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { dataCorsHeaders, dataCorsMiddleware } from "./data-cors.js";

const LISTED = "http://127.0.0.1:8901";

/** Records what a middleware writes, as a node response would hold it. */
class RecordingResponse {
  readonly headers = new Map<string, string>();
  statusCode = 200;
  ended = false;

  setHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }

  end(): this {
    this.ended = true;
    return this;
  }
}

interface MiddlewareRun {
  response: RecordingResponse;
  nextCalls: unknown[][];
}

async function runMiddleware(
  getOrigins: () => Promise<readonly string[]>,
  request: { method: string; origin?: string },
): Promise<MiddlewareRun> {
  const response = new RecordingResponse();
  const nextCalls: unknown[][] = [];
  const headers =
    request.origin === undefined ? {} : { origin: request.origin };
  const incoming = { method: request.method, headers } as IncomingMessage;
  const responded = new Promise<void>((resolve) => {
    const end = response.end.bind(response);
    response.end = () => (resolve(), end());
    dataCorsMiddleware(getOrigins)(
      incoming,
      response as unknown as ServerResponse,
      (...args: unknown[]) => (nextCalls.push(args), resolve()),
    );
  });
  await responded;
  return { response, nextCalls };
}

describe("dataCorsHeaders", () => {
  it("echoes a listed origin and exposes the range headers", () => {
    const headers = dataCorsHeaders([LISTED], LISTED);

    expect(headers).toEqual({
      Vary: "Origin",
      "Access-Control-Allow-Origin": LISTED,
      "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges",
    });
  });

  it("sends only Vary for an unlisted origin", () => {
    const headers = dataCorsHeaders([LISTED], "http://127.0.0.1:8902");

    expect(headers).toEqual({ Vary: "Origin" });
  });

  it("sends only Vary for a same-origin request without Origin", () => {
    const headers = dataCorsHeaders([LISTED], undefined);

    expect(headers).toEqual({ Vary: "Origin" });
  });
});

describe("dataCorsMiddleware", () => {
  it("sets the headers for a listed origin, then passes a GET on", async () => {
    const { response, nextCalls } = await runMiddleware(async () => [LISTED], {
      method: "GET",
      origin: LISTED,
    });

    expect(Object.fromEntries(response.headers)).toEqual(
      dataCorsHeaders([LISTED], LISTED),
    );
    expect(nextCalls).toEqual([[]]);
  });

  it("answers a preflight from a listed origin with 204 and the allowed method and header", async () => {
    const { response, nextCalls } = await runMiddleware(async () => [LISTED], {
      method: "OPTIONS",
      origin: LISTED,
    });

    expect(response.statusCode).toBe(204);
    expect(response.ended).toBe(true);
    expect(Object.fromEntries(response.headers)).toEqual({
      ...dataCorsHeaders([LISTED], LISTED),
      "Access-Control-Allow-Methods": "GET, HEAD",
      "Access-Control-Allow-Headers": "Range",
    });
    expect(nextCalls).toEqual([]);
  });

  it("answers a preflight from an unlisted origin without Access-Control-Allow-Origin", async () => {
    const { response } = await runMiddleware(async () => [LISTED], {
      method: "OPTIONS",
      origin: "http://127.0.0.1:8902",
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("denies every origin while the config fails to load, and passes the request on", async () => {
    const { response, nextCalls } = await runMiddleware(
      () => Promise.reject(new Error("Invalid biac.config.ts")),
      { method: "GET", origin: LISTED },
    );

    expect(Object.fromEntries(response.headers)).toEqual({ Vary: "Origin" });
    expect(nextCalls).toEqual([[]]);
  });
});
