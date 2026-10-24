import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "./dev-server.js";
import { withEmbedOrigins } from "./framing-policy.js";
import { copyShippedProject } from "./shipped-project.js";

/**
 * A temp copy of the shipped project — built, its `biac.config.ts` listing
 * `dataOrigins` — ready for `startBiacServer("preview", dir)`. The caller
 * owns the directory: `rmSync` it when the test ends.
 *
 * @example
 * const dir = builtShippedProject("biac-widget-module-", [hostOrigin]);
 * const preview = await startBiacServer("preview", dir);
 */
export function builtShippedProject(
  prefix: string,
  dataOrigins: readonly string[],
): string {
  const projectDir = mkdtempSync(join(tmpdir(), prefix));
  copyShippedProject(projectDir);
  const configFile = join(projectDir, "biac.config.ts");
  writeFileSync(
    configFile,
    withEmbedOrigins(
      readFileSync(configFile, "utf8"),
      dataOrigins,
      "dataOrigins",
    ),
  );
  buildProject(projectDir);
  return projectDir;
}
