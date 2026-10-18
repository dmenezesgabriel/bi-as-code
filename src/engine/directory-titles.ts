import { unknownKey } from "./biac-config-error.js";
import type { DirectoryTitles, PageManifestEntry } from "./types.js";

/**
 * The `directories` key that titles a first-level folder of `pages/`.
 *
 * @example
 * directoryKey("nested"); // → "pages/nested"
 */
export function directoryKey(folder: string): string {
  return `pages/${folder}`;
}

/**
 * Fails on a `directories` key whose folder holds no page — renamed,
 * deleted or misspelled — naming the folders that do. Discovery decides
 * which folders exist, so this runs where the manifest is built rather
 * than when the config loads; a title that matches nothing would
 * otherwise do nothing, silently.
 *
 * @example
 * checkDirectoryTitles({ "pages/nestd": { title: "Planning" } }, discoverPages("/site"));
 * // throws "directories.pages/nestd: unknown key, expected one of pages/nested (did you mean pages/nested?)"
 */
export function checkDirectoryTitles(
  directories: DirectoryTitles,
  entries: PageManifestEntry[],
): void {
  const folders = pageFolderKeys(entries);
  const stale = Object.keys(directories).find((key) => !folders.has(key));
  if (stale === undefined) return;
  throw unknownKey(stale, ["directories"], [...folders]);
}

/** Every first-level folder of `pages/` that holds a page, at any depth. */
function pageFolderKeys(entries: PageManifestEntry[]): Set<string> {
  const keys = entries
    .map((entry) => entry.file.split("/"))
    .filter((segments) => segments.length > 2)
    .map((segments) => directoryKey(segments[1]!));
  return new Set(keys);
}
