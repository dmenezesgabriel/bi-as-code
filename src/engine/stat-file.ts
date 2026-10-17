import { statSync, type Stats } from "node:fs";

/**
 * The stats of a regular file, or `null` for missing entries and
 * directories alike — callers that serve or run a path treat both as absent.
 *
 * @example
 * statFile("/site/data/a.csv")?.size; // → 1024, or undefined when absent
 */
export function statFile(file: string): Stats | null {
  try {
    const stats = statSync(file);
    return stats.isFile() ? stats : null;
  } catch {
    return null;
  }
}
