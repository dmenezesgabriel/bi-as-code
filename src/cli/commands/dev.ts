import { parseArgs } from "node:util";
import { createServer } from "vite";
import { pagesPlugin } from "../../engine/pages-plugin.js";
import {
  closeOnExitSignals,
  parsePort,
  resolveProjectRoot,
  WEB_CONFIG,
} from "./web-project.js";

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
  return {
    projectRoot: resolveProjectRoot("dev", positionals),
    port: parsePort(values.port),
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
  closeOnExitSignals(server);
}
