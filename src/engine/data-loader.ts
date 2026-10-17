import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, extname, join, sep } from "node:path";
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

/**
 * Where a loader cache reports its runs — the dev server's terminal, a
 * build's output. Plain text lines: this is user-facing CLI output.
 */
export interface DataLoaderLog {
  /** One line per finished run: the loader, its output size and duration. */
  info(line: string): void;
  /** One line per failed run: the {@link DataLoaderError} message. */
  error(line: string): void;
  /** The loader's own stderr, forwarded chunk by chunk as it writes it. */
  stderr(chunk: string): void;
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
 * The posix target a loader source (relative to `data/`) generates — its
 * path without the loader extension.
 *
 * @example
 * dataLoaderTarget("nested/b.parquet.js"); // → "nested/b.parquet"
 */
export function dataLoaderTarget(loader: string): string {
  return loader.slice(0, -LOADER_EXTENSION.length).split(sep).join("/");
}

/**
 * The loader that generates `target` (a posix path relative to `dataDir`),
 * or `null` when a static file already sits at `target` — a real file
 * always wins — or no `<target>.js` exists. A target keeps its own
 * extension (`quakes.csv` ← `quakes.csv.js`), so a helper module such as
 * `lib/fetch.js` is never run as the loader of `lib/fetch`.
 *
 * @example
 * findDataLoader("/site/data", "quakes.csv"); // → "/site/data/quakes.csv.js"
 */
export function findDataLoader(dataDir: string, target: string): string | null {
  if (extname(target) === "") return null;
  if (statFile(join(dataDir, target))) return null;
  const loader = join(dataDir, `${target}${LOADER_EXTENSION}`);
  return statFile(loader) ? loader : null;
}

/**
 * Every target under `dataDir` that a loader generates, as sorted posix
 * paths — the same set `findDataLoader` serves in dev, so a built site
 * ships every output a dev page could fetch.
 *
 * @example
 * listDataLoaderTargets("/site/data"); // → ["nested/b.parquet", "quakes.csv"]
 */
export function listDataLoaderTargets(dataDir: string): string[] {
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir, { recursive: true, encoding: "utf8" })
    .filter(isDataLoaderSource)
    .map(dataLoaderTarget)
    .filter((target) => findDataLoader(dataDir, target) !== null)
    .sort();
}

/**
 * A cache of loader outputs at `.biac/cache/data/<target>` — outside
 * `data/` so the dev mount never serves it and the build never copies it.
 * An output is fresh while its mtime is at least the loader's; concurrent
 * loads of one target share a single run, because DuckDB's HTTP filesystem
 * issues several ranged GETs for one file at once.
 *
 * @example
 * Each run is reported to `log`; a cache hit reports nothing.
 *
 * @example
 * const cache = createDataLoaderCache("/site", terminalLog);
 * await cache.load("quakes.csv"); // → "/site/.biac/cache/data/quakes.csv"
 */
export function createDataLoaderCache(
  projectRoot: string,
  log: DataLoaderLog,
): DataLoaderCache {
  const running = new Map<string, Promise<string>>();
  return {
    load(target) {
      const inFlight = running.get(target);
      if (inFlight) return inFlight;
      const run = loadFresh(projectRoot, target, log).finally(() =>
        running.delete(target),
      );
      running.set(target, run);
      return run;
    },
  };
}

async function loadFresh(
  projectRoot: string,
  target: string,
  log: DataLoaderLog,
): Promise<string> {
  const loader = join(projectRoot, "data", `${target}${LOADER_EXTENSION}`);
  const output = join(projectRoot, ".biac", "cache", "data", target);
  const loaderStats = statFile(loader);
  if (!loaderStats) throw new Error(`no data loader at ${loader}`);
  const outputStats = statFile(output);
  if (outputStats && outputStats.mtimeMs >= loaderStats.mtimeMs) return output;
  await runReported(
    projectRoot,
    `data/${target}${LOADER_EXTENSION}`,
    output,
    log,
  );
  return output;
}

/** Runs the loader into `output`, logging the outcome either way. */
async function runReported(
  projectRoot: string,
  loader: string,
  output: string,
  log: DataLoaderLog,
): Promise<void> {
  const started = performance.now();
  try {
    await runIntoFile(projectRoot, loader, output, log);
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error));
    throw error;
  }
  const ms = Math.round(performance.now() - started);
  const size = statFile(output)!.size;
  // An empty output is still served — DuckDB reads an empty csv as an
  // empty table and names the file when a parquet is too small to read.
  const result = size === 0 ? "empty output" : `${size} bytes`;
  log.info(`data loader ${loader} → ${result} in ${ms} ms`);
}

/** Writes the loader's stdout to a temp file, renamed over `output` only on success. */
async function runIntoFile(
  projectRoot: string,
  loader: string,
  output: string,
  log: DataLoaderLog,
): Promise<void> {
  await mkdir(dirname(output), { recursive: true });
  const temp = `${output}.${process.pid}.tmp`;
  const file = await open(temp, "w");
  try {
    await runLoader(projectRoot, loader, file.fd, log);
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
  log: DataLoaderLog,
): Promise<void> {
  const child = spawn(process.execPath, [loader], {
    cwd: projectRoot,
    stdio: ["ignore", stdoutFd, "pipe"],
    windowsHide: true,
  });
  const stderrTail = collectStderrTail(child, log);
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new DataLoaderError(loader, code ?? -1, stderrTail()));
    });
  });
}

/**
 * Forwards a child's piped stderr to the log as it arrives, and reads back
 * the last lines it wrote so far.
 */
function collectStderrTail(
  child: ChildProcess,
  log: DataLoaderLog,
): () => string {
  let stderr = "";
  child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
    log.stderr(chunk);
    stderr = tailLines(stderr + chunk);
  });
  return () => tailLines(stderr).trimEnd();
}

/** Keeps stderr bounded while a chatty loader runs. */
function tailLines(text: string): string {
  const lines = text.split("\n");
  return lines.slice(-(STDERR_TAIL_LINES + 1)).join("\n");
}
