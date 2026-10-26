import type { ComposeStack } from "./compose-stack.js";

/** A token's payload, as Keycloak's admin API previews it. */
export type TokenClaims = Record<string, unknown>;

/** A search hit from the admin API; only its id is read. */
interface Found {
  id: string;
}

export interface ExampleTokens {
  userId: string;
  idToken: TokenClaims;
  accessToken: TokenClaims;
}

export interface ExampleTokenRequest {
  /** The compose service the admin calls are made from. */
  from: string;
  /** Keycloak's in-network base URL, e.g. `http://keycloak:8080`. */
  baseUrl: string;
  realm: string;
  clientId: string;
  username: string;
  admin: { username: string; password: string };
}

/**
 * Previews the ID and access tokens Keycloak would issue `username` through
 * `clientId`, from the admin API's scope evaluation. Nothing signs in, so the
 * client's own flows (PKCE-only, no direct grants) stay as configured.
 *
 * @example
 * const { idToken } = await exampleTokens(stack, {
 *   from: "probe", baseUrl: "http://keycloak:8080", realm: "biac",
 *   clientId: "biac-dashboard", username: "ada",
 *   admin: { username: "admin", password: "admin" },
 * });
 */
export async function exampleTokens(
  stack: ComposeStack,
  request: ExampleTokenRequest,
): Promise<ExampleTokens> {
  const get = await realmAdmin(stack, request);
  const [client, userId] = await Promise.all([
    onlyId(get, `/clients?clientId=${request.clientId}`),
    onlyId(get, `/users?exact=true&username=${request.username}`),
  ]);
  const preview = (kind: "id" | "access") =>
    get<TokenClaims>(
      `/clients/${client}/evaluate-scopes/generate-example-${kind}-token` +
        `?scope=openid&userId=${userId}`,
    );
  const [idToken, accessToken] = await Promise.all([
    preview("id"),
    preview("access"),
  ]);
  return { userId, idToken, accessToken };
}

/** A GET on the realm's admin API, parsed as the caller expects. */
type RealmAdminGet = <Answer>(path: string) => Promise<Answer>;

async function realmAdmin(
  stack: ComposeStack,
  request: ExampleTokenRequest,
): Promise<RealmAdminGet> {
  const bearer = await adminToken(stack, request);
  return <Answer>(path: string) =>
    adminGet<Answer>(
      stack,
      request,
      bearer,
      `/admin/realms/${request.realm}${path}`,
    );
}

async function onlyId(get: RealmAdminGet, search: string): Promise<string> {
  const [hit] = await get<Found[]>(search);
  if (!hit) {
    throw new Error(
      `Keycloak admin search ${search} found nothing, expected one { id } hit`,
    );
  }
  return hit.id;
}

async function adminToken(
  stack: ComposeStack,
  request: ExampleTokenRequest,
): Promise<string> {
  const answer = await stack.curlFrom(request.from, [
    "-sf",
    "-d",
    "grant_type=password",
    "-d",
    "client_id=admin-cli",
    "--data-urlencode",
    `username=${request.admin.username}`,
    "--data-urlencode",
    `password=${request.admin.password}`,
    `${request.baseUrl}/realms/master/protocol/openid-connect/token`,
  ]);
  const signIn = JSON.parse(answer) as { access_token?: unknown };
  if (typeof signIn.access_token !== "string") {
    throw new Error(
      `Keycloak admin sign-in answered ${answer}, expected { access_token: string }`,
    );
  }
  return signIn.access_token;
}

async function adminGet<Answer>(
  stack: ComposeStack,
  request: ExampleTokenRequest,
  bearer: string,
  path: string,
): Promise<Answer> {
  const answer = await stack.curlFrom(request.from, [
    "-sf",
    "-H",
    `Authorization: Bearer ${bearer}`,
    `${request.baseUrl}${path}`,
  ]);
  return JSON.parse(answer) as Answer;
}
