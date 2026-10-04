import { buildCli } from "../lib/dev-server.js";

/**
 * Every spec spawns `bin/biac dev`, which runs `dist/` — build it once for
 * the whole run instead of once per worker.
 */
export default function globalSetup(): void {
  buildCli();
}
