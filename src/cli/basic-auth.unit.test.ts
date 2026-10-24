import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import {
  BASIC_AUTH_CHALLENGE,
  basicAuthMiddleware,
  basicCredentials,
  biacAuthDisabled,
  checkBasicAuth,
  type BasicAuthEnv,
} from "./basic-auth.js";

const CREDS = { user: "viewer", password: "s3cret" };
const ENV: BasicAuthEnv = {
  BIAC_BASIC_USER: "viewer",
  BIAC_BASIC_PASSWORD: "s3cret",
};

function basicHeader(user: string, password: string): string {
  const token = Buffer.from(user + ":" + password, "utf8").toString("base64");
  return "Basic " + token;
}

/** Records what a middleware writes, as a node response would hold it. */
class RecordingResponse {
  statusCode = 200;
  readonly headers = new Map<string, string>();
  ended = false;

  setHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }

  end(): void {
    this.ended = true;
  }
}

function runMiddleware(
  env: BasicAuthEnv,
  authorization: string | undefined,
): { response: RecordingResponse; nextCalls: number } {
  const response = new RecordingResponse();
  let nextCalls = 0;
  basicAuthMiddleware(env)(
    { headers: { authorization } } as IncomingMessage,
    response as unknown as ServerResponse,
    () => {
      nextCalls += 1;
    },
  );
  return { response, nextCalls };
}

describe("biacAuthDisabled", () => {
  it.each(["1", "true"])("disables auth for %s", (value) => {
    expect(biacAuthDisabled({ BIAC_AUTH_DISABLED: value })).toBe(true);
  });

  it.each(["yes", "0", "false", "TRUE", "", " 1"])(
    "fails closed for %j",
    (value) => {
      expect(biacAuthDisabled({ BIAC_AUTH_DISABLED: value })).toBe(false);
    },
  );

  it("fails closed when the variable is unset", () => {
    expect(biacAuthDisabled({})).toBe(false);
  });
});

describe("basicCredentials", () => {
  it("returns the pair when both variables are set", () => {
    expect(basicCredentials(ENV)).toEqual(CREDS);
  });

  it("returns null when neither is set", () => {
    expect(basicCredentials({})).toBeNull();
  });

  it("names the missing password when only the user is set", () => {
    expect(basicCredentials({ BIAC_BASIC_USER: "viewer" })).toEqual({
      partial: "BIAC_BASIC_PASSWORD",
    });
  });

  it("names the missing user when only the password is set", () => {
    expect(basicCredentials({ BIAC_BASIC_PASSWORD: "s3cret" })).toEqual({
      partial: "BIAC_BASIC_USER",
    });
  });

  it("treats an empty value as unset", () => {
    expect(
      basicCredentials({ BIAC_BASIC_USER: "", BIAC_BASIC_PASSWORD: "" }),
    ).toBeNull();
  });
});

describe("checkBasicAuth", () => {
  it("accepts the right user and password", () => {
    expect(checkBasicAuth(basicHeader("viewer", "s3cret"), CREDS)).toBe(true);
  });

  it.each([
    ["wrong user", "intruder", "s3cret"],
    ["wrong password", "viewer", "guess"],
    ["both wrong", "intruder", "guess"],
    ["a prefix of the password", "viewer", "s3cre"],
    ["the password with a suffix", "viewer", "s3cretX"],
  ])("rejects %s", (_label, user, password) => {
    expect(checkBasicAuth(basicHeader(user, password), CREDS)).toBe(false);
  });

  it.each([
    ["a missing header", undefined],
    ["an empty header", ""],
    ["another scheme", "Bearer abc"],
    ["a scheme without a token", "Basic"],
    [
      "a token without a colon",
      `Basic ${Buffer.from("viewer").toString("base64")}`,
    ],
  ])("rejects %s", (_label, header) => {
    expect(checkBasicAuth(header, CREDS)).toBe(false);
  });

  it("accepts the scheme in any letter case", () => {
    const header = basicHeader("viewer", "s3cret").replace("Basic", "basic");

    expect(checkBasicAuth(header, CREDS)).toBe(true);
  });

  it("splits on the first colon so a password may hold colons", () => {
    const creds = { user: "viewer", password: "a:b:c" };

    expect(checkBasicAuth(basicHeader("viewer", "a:b:c"), creds)).toBe(true);
  });

  it("decodes non-ASCII credentials as UTF-8", () => {
    const creds = { user: "zoë", password: "pässwörd" };

    expect(checkBasicAuth(basicHeader("zoë", "pässwörd"), creds)).toBe(true);
    expect(checkBasicAuth(basicHeader("zoe", "passwörd"), creds)).toBe(false);
  });
});

describe("basicAuthMiddleware", () => {
  it("answers 401 with the challenge and does not pass on without a header", () => {
    const { response, nextCalls } = runMiddleware(ENV, undefined);

    expect(response.statusCode).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe(BASIC_AUTH_CHALLENGE);
    expect(response.ended).toBe(true);
    expect(nextCalls).toBe(0);
  });

  it("answers 401 for a wrong password", () => {
    const { response, nextCalls } = runMiddleware(
      ENV,
      basicHeader("viewer", "guess"),
    );

    expect(response.statusCode).toBe(401);
    expect(nextCalls).toBe(0);
  });

  it("passes the request on for the right credentials", () => {
    const { response, nextCalls } = runMiddleware(
      ENV,
      basicHeader("viewer", "s3cret"),
    );

    expect(response.statusCode).toBe(200);
    expect(nextCalls).toBe(1);
  });

  it("passes every request on when no credentials are configured", () => {
    expect(runMiddleware({}, undefined).nextCalls).toBe(1);
  });

  it("passes every request on when auth is explicitly disabled", () => {
    const env = { ...ENV, BIAC_AUTH_DISABLED: "true" };

    expect(runMiddleware(env, undefined).nextCalls).toBe(1);
  });

  it("passes every request on for a half-set pair", () => {
    const env = { BIAC_BASIC_USER: "viewer" };

    expect(runMiddleware(env, undefined).nextCalls).toBe(1);
  });

  it("states the challenge so non-ASCII credentials are UTF-8", () => {
    expect(BASIC_AUTH_CHALLENGE).toBe('Basic realm="biac", charset="UTF-8"');
  });
});
