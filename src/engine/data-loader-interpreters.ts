import type { DataLoaderInterpreters } from "./types.js";

/**
 * The interpreter every loader language runs with unless a project
 * overrides it. The same twelve languages and commands as Observable
 * Framework's `interpreters` option
 * (https://github.com/observablehq/framework/blob/main/docs/config.md#interpreters),
 * except `.js` and `.ts`: both run with
 * the node running biac, so no `PATH` lookup and no `tsx` install is
 * involved. Node strips TypeScript types without transforming code, so a
 * `.ts` loader may not use `enum`, runtime `namespace` or parameter
 * properties, and must import local modules with their `.ts` extension
 * (https://nodejs.org/docs/latest-v24.x/api/typescript.html); a project
 * that needs those maps `".ts": ["tsx"]`.
 */
export const DEFAULT_INTERPRETERS: DataLoaderInterpreters = {
  ".js": [process.execPath],
  ".ts": [process.execPath],
  ".py": ["python3"],
  ".r": ["Rscript"],
  ".R": ["Rscript"],
  ".rs": ["rust-script"],
  ".go": ["go", "run"],
  ".java": ["java"],
  ".jl": ["julia"],
  ".php": ["php"],
  ".sh": ["sh"],
  ".exe": [],
};

/**
 * The registered extension `path` ends with, compared case-insensitively
 * so `a.csv.PY` counts as program source on a case-insensitive
 * filesystem; `null` when no interpreter runs it.
 *
 * @example
 * loaderExtension("a.csv.py", DEFAULT_INTERPRETERS); // → ".py"
 */
export function loaderExtension(
  path: string,
  interpreters: DataLoaderInterpreters,
): string | null {
  const lowerPath = path.toLowerCase();
  const extensions = Object.keys(interpreters);
  return (
    extensions.find((ext) => lowerPath.endsWith(ext.toLowerCase())) ?? null
  );
}

/**
 * The argv that runs `loader`: its interpreter's argv with the loader
 * appended, or the loader alone when the argv is empty. The extension is
 * matched case-sensitively, as the filesystem resolves `.r` and `.R`.
 *
 * @example
 * loaderCommand("data/a.csv.go", DEFAULT_INTERPRETERS);
 * // → ["go", "run", "data/a.csv.go"]
 */
export function loaderCommand(
  loader: string,
  interpreters: DataLoaderInterpreters,
): string[] {
  const extensions = Object.keys(interpreters);
  const ext = extensions.find((key) => loader.endsWith(key));
  if (ext === undefined) {
    throw new Error(
      `no interpreter for ${JSON.stringify(loader)}; expected one of: ${extensions.join(", ")}`,
    );
  }
  return [...interpreters[ext]!, loader];
}
