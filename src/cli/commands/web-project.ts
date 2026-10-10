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
