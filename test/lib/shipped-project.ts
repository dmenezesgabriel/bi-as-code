import { cpSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Copies the shipped example project into a temp project dir — `pages/`,
 * `queries/`, `data/` (the `sql:` fixtures), `biac.config.ts` and
 * `translations.yaml` — so test
 * servers run the same tree a user gets.
 *
 * @example
 * const root = mkdtempSync(join(tmpdir(), "biac-"));
 * copyShippedProject(root);
 */
export function copyShippedProject(projectRoot: string): void {
  for (const entry of ["pages", "queries", "data"]) {
    cpSync(join(repoRoot, entry), join(projectRoot, entry), {
      recursive: true,
    });
  }
  for (const file of ["biac.config.ts", "translations.yaml"]) {
    cpSync(join(repoRoot, file), join(projectRoot, file));
  }
}
