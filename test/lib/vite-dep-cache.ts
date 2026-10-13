import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// `biac dev` serves `src/web` as vite's root, so every project shares this
// dep cache — the one a user's next `bin/biac dev` starts warm from.
export const sharedCacheDir = fileURLToPath(
  new URL("../../src/web/node_modules/.vite", import.meta.url),
);

/**
 * Counts the `deps_temp_*` dirs vite left in the shared cache — each one is
 * an optimize that was stopped before it committed.
 *
 * @example
 * const before = tempDirCount();
 */
export function tempDirCount(): number {
  if (!existsSync(sharedCacheDir)) return 0;
  return readdirSync(sharedCacheDir).filter((name) =>
    name.startsWith("deps_temp_"),
  ).length;
}

/**
 * Reads the `configHash` of the committed `deps/` cache, or `undefined`
 * when no optimize has committed one yet.
 *
 * @example
 * expect(committedConfigHash()).toBe(hashBefore);
 */
export function committedConfigHash(): string | undefined {
  const metadataFile = join(sharedCacheDir, "deps/_metadata.json");
  if (!existsSync(metadataFile)) return undefined;
  const metadata = readFileSync(metadataFile, "utf8");
  return (JSON.parse(metadata) as { configHash: string }).configHash;
}
