import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Both src/ and dist/ sit three levels below the repo root, so this one
// literal finds the web config from the source tree and the compiled CLI
// alike. The path is passed to vite, not imported — dep-cruise forbids
// cli -> web module imports.
export const WEB_CONFIG = fileURLToPath(
  new URL("../../../src/web/vite.config.ts", import.meta.url),
);

/**
 * Resolves the optional project-directory positional every project command
 * takes, defaulting to the current directory.
 *
 * @example
 * resolveProjectRoot("build", ["site"]); // "<cwd>/site"
 */
export function resolveProjectRoot(
  command: string,
  positionals: string[],
): string {
  if (positionals.length > 1) {
    throw new Error(
      `biac ${command} takes at most one project directory, got: ${positionals.join(", ")}`,
    );
  }
  return resolve(positionals[0] ?? process.cwd());
}

/**
 * Validates a `--port` value; `undefined` leaves the port to the web config,
 * and 0 asks the OS for an ephemeral port.
 *
 * @example
 * parsePort("0"); // 0
 */
export function parsePort(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`--port must be an integer in 0..65535, got "${raw}"`);
  }
  return port;
}

/**
 * Closes `server` and exits 0 on SIGINT/SIGTERM, so Ctrl-C on a long-running
 * command looks clean instead of dying mid-request.
 *
 * @example
 * closeOnExitSignals(await createServer(config));
 */
export function closeOnExitSignals(server: { close(): Promise<void> }): void {
  const shutdown = () => {
    void server.close().then(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
