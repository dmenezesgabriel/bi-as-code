import { parseArgs } from "node:util";
import { createServer } from "vite";
import { pagesPlugin } from "../../engine/pages-plugin.js";
import { resolveProjectRoot, WEB_CONFIG } from "./web-project.js";

export interface DevOptions {
  /** Directory containing `pages/`; defaults to the current directory. */
  projectRoot: string;
  /** Override for the web config's `server.port`; 0 binds an ephemeral port. */
  port?: number;
}

export function parseDevArgs(args: string[]): DevOptions {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { port: { type: "string" } },
  });
  const port = values.port === undefined ? undefined : Number(values.port);
  if (
    port !== undefined &&
    (!Number.isInteger(port) || port < 0 || port > 65535)
  ) {
    throw new Error(
      `--port must be an integer in 0..65535, got "${values.port}"`,
    );
  }
  return {
    projectRoot: resolveProjectRoot("dev", positionals),
    port,
  };
}

/**
 * Starts the vite dev server for `projectRoot`'s pages and returns once it is
 * listening — the open sockets keep the process alive, and SIGINT/SIGTERM
 * close the server before exiting 0 so Ctrl-C looks clean.
 *
 * @example
 * // in main.ts: case "dev": await dev(["site", "--port", "0"]);
 */
export async function dev(args: string[]): Promise<void> {
  const { projectRoot, port } = parseDevArgs(args);
  const server = await createServer({
    configFile: WEB_CONFIG,
    plugins: [pagesPlugin(projectRoot)],
    server: port === undefined ? {} : { port },
  });
  await server.listen();
  console.log(`biac dev — serving ${projectRoot}`);
  server.printUrls();
  const shutdown = () => {
    void server.close().then(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
