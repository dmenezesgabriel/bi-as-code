import { createHash, timingSafeEqual } from "node:crypto";
import type { Connect } from "vite";

/** The slice of the process environment the auth variables are read from. */
export type BasicAuthEnv = Readonly<Record<string, string | undefined>>;

export interface BasicCredentials {
  readonly user: string;
  readonly password: string;
}

/** One of the two variables is set without the other; `partial` names the missing one. */
export interface PartialCredentials {
  readonly partial: string;
}

/** RFC 7617 §2.1: `charset` tells clients to send non-ASCII credentials as UTF-8. */
export const BASIC_AUTH_CHALLENGE = 'Basic realm="biac", charset="UTF-8"';

const USER_VARIABLE = "BIAC_BASIC_USER";
const SECRET_VARIABLE = "BIAC_BASIC_PASSWORD";

/**
 * Whether the operator opted out of authentication. Only the exact values `1`
 * and `true` count, so a mistyped value (`yes`, `TRUE`) keeps auth on instead
 * of silently publishing the build.
 *
 * @example
 * biacAuthDisabled({ BIAC_AUTH_DISABLED: "true" }); // → true
 */
export function biacAuthDisabled(env: BasicAuthEnv): boolean {
  const value = env.BIAC_AUTH_DISABLED;
  return value === "1" || value === "true";
}

/**
 * Reads the credential pair from the environment. An empty value counts as
 * unset; one variable without the other is reported rather than enforced, so
 * the caller can warn about it.
 *
 * @example
 * basicCredentials({ BIAC_BASIC_USER: "viewer" }); // → { partial: "BIAC_BASIC_PASSWORD" }
 */
export function basicCredentials(
  env: BasicAuthEnv,
): BasicCredentials | PartialCredentials | null {
  const user = env[USER_VARIABLE];
  const password = env[SECRET_VARIABLE];
  if (user && password) return { user, password };
  if (user) return { partial: SECRET_VARIABLE };
  if (password) return { partial: USER_VARIABLE };
  return null;
}

/**
 * Compares through SHA-256 digests so both buffers always have the same
 * length: comparing raw bytes would need a length check first, and that early
 * return leaks the secret's length through timing.
 */
function sameSecret(supplied: string, expected: string): boolean {
  const digest = (text: string): Buffer =>
    createHash("sha256").update(text, "utf8").digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}

function decodeBasicToken(header: string | undefined): string | null {
  const match = /^basic +(\S+)$/i.exec(header ?? "");
  if (!match?.[1]) return null;
  return Buffer.from(match[1], "base64").toString("utf8");
}

/**
 * Checks an `Authorization` header against the configured pair. The decoded
 * text splits on the first colon (a password may hold colons, a user may not).
 *
 * @example
 * checkBasicAuth("Basic dmlld2VyOnMzY3JldA==", { user: "viewer", password: "s3cret" }); // → true
 */
export function checkBasicAuth(
  header: string | undefined,
  creds: BasicCredentials,
): boolean {
  const decoded = decodeBasicToken(header);
  const separator = decoded?.indexOf(":") ?? -1;
  if (decoded === null || separator === -1) return false;
  // Both comparisons run before they combine, so a wrong user costs as much as a wrong password.
  const userMatches = sameSecret(decoded.slice(0, separator), creds.user);
  const passwordMatches = sameSecret(
    decoded.slice(separator + 1),
    creds.password,
  );
  return userMatches && passwordMatches;
}

function isEnforced(
  creds: BasicCredentials | PartialCredentials | null,
): creds is BasicCredentials {
  return creds !== null && "user" in creds;
}

/**
 * Answers `401` with the challenge to any request that lacks the configured
 * credentials, and passes everything on when auth is disabled or unconfigured.
 * A half-set pair is not enforced here: refusing to start beyond localhost is
 * the boot guard's job, and a loopback server stays open.
 *
 * @example
 * server.middlewares.use(basicAuthMiddleware(process.env));
 */
export function basicAuthMiddleware(
  env: BasicAuthEnv,
): Connect.NextHandleFunction {
  const creds = basicCredentials(env);
  if (biacAuthDisabled(env) || !isEnforced(creds)) {
    return (_request, _response, next) => next();
  }
  return (request, response, next) => {
    if (checkBasicAuth(request.headers.authorization, creds)) return next();
    response.statusCode = 401;
    response.setHeader("WWW-Authenticate", BASIC_AUTH_CHALLENGE);
    response.end();
  };
}
