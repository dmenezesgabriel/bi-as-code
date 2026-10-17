import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { statFile } from "./stat-file.js";

/** Loader extension → the file it generates sits beside it without it. */
const LOADER_EXTENSION = ".js";
const STDERR_TAIL_LINES = 20;

/**
 * A data loader that exited non-zero. Carries what a dev error or a failed
 * build needs to locate the failure without scrolling the terminal.
 */
export class DataLoaderError extends Error {
  constructor(
    /** Project-relative posix path, e.g. "data/quakes.csv.js". */
    readonly loader: string,
    readonly exitCode: number,
    /** The last lines the loader wrote to stderr, trailing newline trimmed. */
    readonly stderrTail: string,
  ) {
    super(
      `data loader ${loader} exited with code ${exitCode}, expected 0` +
        (stderrTail ? `; stderr:\n${stderrTail}` : ""),
    );
    this.name = "DataLoaderError";
  }
}

/** Runs data loaders on demand and caches their output under the project root. */
export interface DataLoaderCache {
  /** Absolute path of the target's up-to-date output, running its loader if stale. */
  load(target: string): Promise<string>;
}

/**
 * Whether a `data/` path is program source rather than data: a loader or a
 * module a loader imports. DuckDB never reads `.js`, and a loader may hold
 * credentials, so such a path is never served or shipped. Case-insensitive
 * so `a.csv.JS` stays private on a case-insensitive filesystem.
 *
 * @example
 * isDataLoaderSource("quakes.csv.js"); // → true
 * isDataLoaderSource("quakes.csv"); // → false
 */
export function isDataLoaderSource(path: string): boolean {
  return path.toLowerCase().endsWith(LOADER_EXTENSION);
}

/**
 * The loader that generates `target` (a posix path relative to `dataDir`),
 * or `null` when a static file already sits at `target` — a real file
 * always wins — or no `<target>.js` exists.
 *
 * @example
 * findDataLoader("/site/data", "quakes.csv"); // → "/site/data/quakes.csv.js"
 */
export function findDataLoader(dataDir: string, target: string): string | null {
  if (statFile(join(dataDir, target))) return null;
  const loader = join(dataDir, `${target}${LOADER_EXTENSION}`);
  return statFile(loader) ? loader : null;
}

/**
 * A cache of loader outputs at `.biac/cache/data/<target>` — outside
 * `data/` so the dev mount never serves it and the build never copies it.
 * An output is fresh while its mtime is at least the loader's; concurrent
 * loads of one target share a single run, because DuckDB's HTTP filesystem
 * issues several ranged GETs for one file at once.
 *
 * @example
 * const cache = createDataLoaderCache("/site");
 * await cache.load("quakes.csv"); // → "/site/.biac/cache/data/quakes.csv"
 */
export function createDataLoaderCache(projectRoot: string): DataLoaderCache {
  const running = new Map<string, Promise<string>>();
  return {
    load(target) {
      const inFlight = running.get(target);
      if (inFlight) return inFlight;
      const run = loadFresh(projectRoot, target).finally(() =>
        running.delete(target),
      );
      running.set(target, run);
      return run;
    },
  };
}

async function loadFresh(projectRoot: string, target: string): Promise<string> {
  const loader = join(projectRoot, "data", `${target}${LOADER_EXTENSION}`);
  const output = join(projectRoot, ".biac", "cache", "data", target);
  const loaderStats = statFile(loader);
  if (!loaderStats) throw new Error(`no data loader at ${loader}`);
  const outputStats = statFile(output);
  if (outputStats && outputStats.mtimeMs >= loaderStats.mtimeMs) return output;
  await runIntoFile(projectRoot, `data/${target}${LOADER_EXTENSION}`, output);
  return output;
}

/** Writes the loader's stdout to a temp file, renamed over `output` only on success. */
async function runIntoFile(
  projectRoot: string,
  loader: string,
  output: string,
): Promise<void> {
  await mkdir(dirname(output), { recursive: true });
  const temp = `${output}.${process.pid}.tmp`;
  const file = await open(temp, "w");
  try {
    await runLoader(projectRoot, loader, file.fd);
  } catch (error) {
    await unlink(temp);
    throw error;
  } finally {
    await file.close();
  }
  await rename(temp, output);
}

/** Runs the loader with the node running biac, so no `PATH` lookup is involved. */
function runLoader(
  projectRoot: string,
  loader: string,
  stdoutFd: number,
): Promise<void> {
  const child = spawn(process.execPath, [loader], {
    cwd: projectRoot,
    stdio: ["ignore", stdoutFd, "pipe"],
    windowsHide: true,
  });
  const stderrTail = collectStderrTail(child);
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new DataLoaderError(loader, code ?? -1, stderrTail()));
    });
  });
}

/** Reads the last lines a child wrote to its piped stderr, so far. */
function collectStderrTail(child: ChildProcess): () => string {
  let stderr = "";
  child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
    stderr = tailLines(stderr + chunk);
  });
  return () => tailLines(stderr).trimEnd();
}

/** Keeps stderr bounded while a chatty loader runs. */
function tailLines(text: string): string {
  const lines = text.split("\n");
  return lines.slice(-(STDERR_TAIL_LINES + 1)).join("\n");
}
