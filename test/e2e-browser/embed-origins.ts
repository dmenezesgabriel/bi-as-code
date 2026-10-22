import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withEmbedOrigins } from "../lib/framing-policy.js";
import { rewriteUntilServerLogs } from "../lib/write-until-logged.js";

/**
 * Rewrites the project's own config with `embed[key]` set to `origins`,
 * until the dev server reports the edit — `origins` to frame pages,
 * `dataOrigins` to read `/data/` cross-origin.
 *
 * @example
 * await listOrigins(biacDev.projectDir, biacDev.log, ["http://127.0.0.1:8901"], "dataOrigins");
 */
export async function listOrigins(
  projectDir: string,
  log: () => readonly string[],
  origins: readonly string[],
  key: "origins" | "dataOrigins" = "origins",
): Promise<void> {
  const configFile = join(projectDir, "biac.config.ts");
  const config = readFileSync(configFile, "utf8");
  await rewriteUntilServerLogs({
    rewrite: () =>
      writeFileSync(configFile, withEmbedOrigins(config, origins, key)),
    log,
    loggedPath: "biac.config.ts",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
}
