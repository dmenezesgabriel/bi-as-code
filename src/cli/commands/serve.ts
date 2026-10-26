import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { preview as vitePreview, type Plugin } from "vite";
import { loadBiacConfig } from "../../engine/biac-config.js";
import {
  basicAuthMiddleware,
  basicCredentials,
  biacAuthDisabled,
  type BasicAuthEnv,
} from "../basic-auth.js";
import { serveHeadersMiddleware } from "../serve-headers.js";
import { serveRoutesPlugin } from "../serve-routes.js";
import { staticHostPlugins } from "./static-plugins.js";
import {
  closeOnExitSignals,
  parsePort,
  resolveProjectRoot,
} from "./web-project.js";

export interface ServeOptions {
  /** Directory whose `build/` is served; defaults to the current directory. */
  projectRoot: string;
  /** Bind address; loopback unless the operator asks for more. */
  host: string;
  /** 3000 is the container convention; 0 binds an ephemeral port. */
  port: number;
}

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
]);
const DEFAULT_PORT = 3000;

export function parseServeArgs(args: string[]): ServeOptions {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { port: { type: "string" }, host: { type: "string" } },
  });
  return {
    projectRoot: resolveProjectRoot("serve", positionals),
    host: values.host ?? "127.0.0.1",
    port: parsePort(values.port) ?? DEFAULT_PORT,
  };
}

function isEnforced(env: BasicAuthEnv): boolean {
  const creds = basicCredentials(env);
  return creds !== null && "user" in creds;
}

/**
 * Whether binding `host` would publish the build with no authentication:
 * beyond loopback, with neither a full credential pair nor the explicit
 * opt-out.
 *
 * @example
 * serveRequiresAuth("0.0.0.0", {}); // → true
 */
export function serveRequiresAuth(host: string, env: BasicAuthEnv): boolean {
  if (LOOPBACK_HOSTS.has(host)) return false;
  return !biacAuthDisabled(env) && !isEnforced(env);
}

export function assertBootAllowed(host: string, env: BasicAuthEnv): void {
  if (!serveRequiresAuth(host, env)) return;
  throw new Error(
    `biac serve: refusing to serve beyond localhost (host "${host}") without auth — ` +
      "set BIAC_BASIC_USER and BIAC_BASIC_PASSWORD, keep --host on 127.0.0.1, " +
      "or, on a trusted private network only, set BIAC_AUTH_DISABLED=true",
  );
}

/** Messages the operator should see on stderr before the server starts. */
export function authWarnings(host: string, env: BasicAuthEnv): string[] {
  const creds = basicCredentials(env);
  const warnings: string[] = [];
  if (creds !== null && "partial" in creds) {
    warnings.push(
      `biac serve: only one credential variable is set — ${creds.partial} is missing, so basic auth is not enforced`,
    );
  }
  if (biacAuthDisabled(env) && !LOOPBACK_HOSTS.has(host)) {
    warnings.push(
      "WARNING: authentication is disabled (BIAC_AUTH_DISABLED). Every page and data file is open to anyone who can reach this server. Use only on a trusted private network.",
    );
  }
  return warnings;
}

/** The one-line auth summary printed after the URLs. */
export function authModeLine(host: string, env: BasicAuthEnv): string {
  const creds = basicCredentials(env);
  if (biacAuthDisabled(env)) return "auth: DISABLED (BIAC_AUTH_DISABLED)";
  if (creds !== null && "user" in creds) {
    return `auth: basic (user ${creds.user})`;
  }
  return LOOPBACK_HOSTS.has(host) ? "auth: none (loopback only)" : "auth: none";
}

/**
 * Mounts the response headers, then the credential check, ahead of every
 * other middleware: headers first so a `401` carries them too, auth before
 * the static files so nothing is served unchecked.
 */
function servePolicyPlugins(base: string, env: BasicAuthEnv): Plugin[] {
  return [
    {
      name: "biac:serve-headers",
      configurePreviewServer(server) {
        server.middlewares.use(serveHeadersMiddleware(base));
      },
    },
    {
      name: "biac:serve-basic-auth",
      configurePreviewServer(server) {
        server.middlewares.use(basicAuthMiddleware(env));
      },
    },
  ];
}

/**
 * Serves `<projectRoot>/build` as a production site: basic auth from
 * `BIAC_BASIC_USER`/`BIAC_BASIC_PASSWORD`, a refusal to bind beyond
 * localhost without it, hardened response headers, and the static-host
 * contract `biac preview` keeps. Returns once listening; SIGINT/SIGTERM close
 * the server.
 *
 * @example
 * await serve(["site", "--port", "8933"], process.env);
 */
export async function serve(
  args: string[],
  env: BasicAuthEnv = process.env,
): Promise<void> {
  const { projectRoot, host, port } = parseServeArgs(args);
  const outDir = join(projectRoot, "build");
  if (!existsSync(outDir)) {
    throw new Error(
      `biac serve: no build at ${outDir} — run \`biac build\` first`,
    );
  }
  assertBootAllowed(host, env);
  authWarnings(host, env).forEach((warning) => console.warn(warning));
  const { embed, base } = await loadBiacConfig(projectRoot);
  const server = await vitePreview({
    // Serving a finished build needs none of the SPA's vite config, whose
    // plugins are devDependencies: a production install carries only vite.
    configFile: false,
    base,
    // mpa: an unmatched path is a miss, not the SPA shell with a 200.
    appType: "mpa",
    build: { outDir },
    plugins: [
      ...servePolicyPlugins(base, env),
      ...staticHostPlugins(base, outDir, embed),
      serveRoutesPlugin(outDir),
    ],
    preview: {
      cors: false,
      // A production server receives the public Host from its proxy; the
      // deployer owns the perimeter.
      allowedHosts: true,
      // A taken port must fail loudly, not drift to the next one.
      strictPort: true,
      host,
      port,
    },
  });
  console.log(`biac serve — serving ${outDir}`);
  server.printUrls();
  console.log(authModeLine(host, env));
  closeOnExitSignals(server);
}
