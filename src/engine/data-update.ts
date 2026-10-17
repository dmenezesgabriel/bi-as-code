import { isAbsolute, relative, sep } from "node:path";
import { dataLoaderTarget, isDataLoaderSource } from "./data-loader.js";
import { statFile } from "./stat-file.js";
import type { DataLoaderInterpreters } from "./types.js";

/** The custom HMR event the dev server sends when a `data/` file changes. */
export const DATA_UPDATE_EVENT = "biac:data-update";

/** A changed data target: its served path and the watched file's mtime. */
export interface DataUpdate {
  path: string;
  version: number;
}

/**
 * The data target a watched file change refreshes, or `null` when the
 * change refreshes nothing: a path outside `dataDir`, a missing file or
 * directory, an empty file, or an mtime equal to `previous` (the version
 * last sent for this file). A loader source refreshes the target it
 * generates, which re-runs on its next fetch.
 *
 * @example
 * dataUpdateFor("/site/data/x.csv.py", "/site/data", undefined, DEFAULT_INTERPRETERS);
 * // → { path: "data/x.csv", version: 1760700000000 }
 */
export function dataUpdateFor(
  file: string,
  dataDir: string,
  previous: number | undefined,
  interpreters: DataLoaderInterpreters,
): DataUpdate | null {
  const relativePath = relative(dataDir, file);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) return null;
  const stats = statFile(file);
  // An editor that truncates before writing fires on the empty file first.
  if (!stats || stats.size === 0 || stats.mtimeMs === previous) return null;
  const target = isDataLoaderSource(relativePath, interpreters)
    ? dataLoaderTarget(relativePath, interpreters)
    : relativePath.split(sep).join("/");
  return { path: `data/${target}`, version: stats.mtimeMs };
}
