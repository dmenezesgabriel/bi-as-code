import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { resolveContained } from "./contained-path.js";
import { statFile } from "./stat-file.js";
import type { QueryFiles } from "./types.js";

/**
 * The project's `<root>/queries/` directory on disk. A name that climbs out
 * of it (`../secret.sql`) reads as missing, so a page cannot inline any
 * other file of the project into its module.
 *
 * @example
 * await diskQueryFiles("/site").read("sales/totals.sql"); // → "select …"
 */
export function diskQueryFiles(root: string): QueryFiles {
  const queriesDir = join(root, "queries");
  return {
    async read(name) {
      const file = resolveContained(queriesDir, `/${name}`);
      if (file === null || statFile(file) === null) return undefined;
      return readFile(file, "utf8");
    },
    list: () => listSqlFiles(queriesDir),
  };
}

async function listSqlFiles(queriesDir: string): Promise<string[]> {
  try {
    const entries = await readdir(queriesDir, { recursive: true });
    return entries
      .filter((entry) => entry.endsWith(".sql"))
      .map((entry) => entry.split(sep).join("/"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
