import type { ComposeStack } from "./compose-stack.js";

export interface EdgeSignInRequest {
  /** The compose service curl runs in. */
  from: string;
  /** curl options that reach the edge as a browser does (TLS, `--connect-to`). */
  asBrowser: readonly string[];
  /** The page to open; the edge sends the viewer to sign in first. */
  url: string;
  /** Cookie jar inside `from`; later requests pass `-b <jar>` to reuse the session. */
  jar: string;
  username: string;
  password: string;
}

/** Where the browser lands after submitting the sign-in form. */
export interface SignInLanding {
  status: string;
  url: string;
}

/**
 * Signs in at the edge the way a browser does: opens `url`, follows the
 * redirects to Keycloak's login form, submits it, and follows the redirects
 * back through `/oauth2/callback`, keeping every cookie in `jar`.
 *
 * @example
 * const landing = await signInAtEdge(stack, {
 *   from: "probe", asBrowser: ["-sk"], url: "https://localhost:8443/",
 *   jar: "/tmp/ada.jar", username: "ada", password: "biac-demo",
 * });
 */
export async function signInAtEdge(
  stack: ComposeStack,
  request: EdgeSignInRequest,
): Promise<SignInLanding> {
  const loginPage = await stack.curlFrom(request.from, [
    ...browsing(request),
    request.url,
  ]);
  const answer = await stack.curlFrom(request.from, [
    ...browsing(request),
    "--data-urlencode",
    `username=${request.username}`,
    "--data-urlencode",
    `password=${request.password}`,
    "-o",
    "/dev/null",
    "-w",
    "%{http_code} %{url_effective}",
    loginFormAction(loginPage),
  ]);
  const [status = "", url = ""] = answer.split(" ");
  return { status, url };
}

/** Follows redirects and keeps cookies, as a browser does. */
function browsing(request: EdgeSignInRequest): string[] {
  return [...request.asBrowser, "-L", "-c", request.jar, "-b", request.jar];
}

function loginFormAction(page: string): string {
  const action = page.match(
    /<form id="kc-form-login"[^>]*action="([^"]+)"/,
  )?.[1];
  if (!action) {
    throw new Error(
      `expected Keycloak's login page with <form id="kc-form-login" action="…">, got: ${page.slice(0, 300)}`,
    );
  }
  return action.replaceAll("&amp;", "&");
}
