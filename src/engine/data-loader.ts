import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, extname, join, relative, sep } from "node:path";
import { loaderCommand, loaderExtension } from "./data-loader-interpreters.js";
import { statFile } from "./stat-file.js";
import type { DataLoaderInterpreters } from "./types.js";

const STDERR_TAIL_LINES = 20;

/**
 * A data loader that could not produce its output, with a message that
 * names the loader — what a dev `500` or a failed build shows.
 */
export class DataLoaderFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataLoaderFailure";
  }
}

/**
 * A data loader that exited non-zero. Carries what a dev error or a failed
 * build needs to locate the failure without scrolling the terminal.
 */
export class DataLoaderError extends DataLoaderFailure {
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
 * module a loader imports, i.e. any extension an interpreter runs. DuckDB
 * never reads those, and a loader may hold credentials, so such a path is
 * never served or shipped. Case-insensitive so `a.csv.PY` stays private on
 * a case-insensitive filesystem.
 *
 * @example
 * isDataLoaderSource("quakes.csv.py", DEFAULT_INTERPRETERS); // → true
 * isDataLoaderSource("quakes.csv", DEFAULT_INTERPRETERS); // → false
 */
export function isDataLoaderSource(
  path: string,
  interpreters: DataLoaderInterpreters,
): boolean {
  return loaderExtension(path, interpreters) !== null;
}

/**
 * The posix target a loader source (relative to `data/`) generates — its
 * path without the loader extension.
 *
 * @example
 * dataLoaderTarget("nested/b.parquet.py", DEFAULT_INTERPRETERS);
 * // → "nested/b.parquet"
 */
export function dataLoaderTarget(
  loader: string,
  interpreters: DataLoaderInterpreters,
): string {
  const ext = loaderExtension(loader, interpreters) ?? "";
  return loader
    .slice(0, loader.length - ext.length)
    .split(sep)
    .join("/");
}

/**
 * The loader that generates `target` (a posix path relative to `dataDir`),
 * or `null` when a static file already sits at `target` — a real file
 * always wins — or no `<target><ext>` exists for a registered extension.
 * A target keeps its own extension (`quakes.csv` ← `quakes.csv.py`), so a
 * helper module such as `lib/fetch.py` is never run as the loader of
 * `lib/fetch`. Two loaders for one target throw rather than one silently
 * shadowing the other.
 *
 * @example
 * findDataLoader("/site/data", "quakes.csv", DEFAULT_INTERPRETERS);
 * // → "/site/data/quakes.csv.py"
 */
export function findDataLoader(
  dataDir: string,
  target: string,
  interpreters: DataLoaderInterpreters,
): string | null {
  if (extname(target) === "") return null;
  if (statFile(join(dataDir, target))) return null;
  const loaders = Object.keys(interpreters)
    .map((ext) => join(dataDir, `${target}${ext}`))
    .filter((loader) => statFile(loader) !== null);
  if (loaders.length > 1) throw ambiguousLoaders(dataDir, target, loaders);
  return loaders[0] ?? null;
}

/** `dataDir/a.csv.py` as the project-relative posix `data/a.csv.py` messages name. */
function projectDataPath(dataDir: string, file: string): string {
  return join("data", relative(dataDir, file)).split(sep).join("/");
}

function ambiguousLoaders(
  dataDir: string,
  target: string,
  loaders: string[],
): DataLoaderFailure {
  const named = loaders.map((loader) => projectDataPath(dataDir, loader));
  return new DataLoaderFailure(
    `data/${target} has ${loaders.length} data loaders, expected 1: ${named.join(", ")}`,
  );
}

/**
 * Every target under `dataDir` that a loader generates, as sorted posix
 * paths — the same set `findDataLoader` serves in dev, so a built site
 * ships every output a dev page could fetch.
 *
 * @example
 * listDataLoaderTargets("/site/data", DEFAULT_INTERPRETERS);
 * // → ["nested/b.parquet", "quakes.csv"]
 */
export function listDataLoaderTargets(
  dataDir: string,
  interpreters: DataLoaderInterpreters,
): string[] {
  if (!existsSync(dataDir)) return [];
  const targets = readdirSync(dataDir, { recursive: true, encoding: "utf8" })
    .filter((path) => isDataLoaderSource(path, interpreters))
    .map((path) => dataLoaderTarget(path, interpreters));
  return [...new Set(targets)]
    .filter((target) => findDataLoader(dataDir, target, interpreters) !== null)
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
 * const cache = createDataLoaderCache("/site", terminalLog, DEFAULT_INTERPRETERS);
 * await cache.load("quakes.csv"); // → "/site/.biac/cache/data/quakes.csv"
 */
export function createDataLoaderCache(
  projectRoot: string,
  log: DataLoaderLog,
  interpreters: DataLoaderInterpreters,
): DataLoaderCache {
  const running = new Map<string, Promise<string>>();
  const runContext: LoaderRunContext = { projectRoot, log, interpreters };
  return {
    load(target) {
      const inFlight = running.get(target);
      if (inFlight) return inFlight;
      const run = loadFresh(runContext, target).finally(() =>
        running.delete(target),
      );
      running.set(target, run);
      return run;
    },
  };
}

/** What every loader run of one cache shares. */
interface LoaderRunContext {
  projectRoot: string;
  log: DataLoaderLog;
  interpreters: DataLoaderInterpreters;
}

async function loadFresh(
  context: LoaderRunContext,
  target: string,
): Promise<string> {
  const dataDir = join(context.projectRoot, "data");
  const loader = findDataLoader(dataDir, target, context.interpreters);
  if (!loader) throw new Error(`no data loader for ${join(dataDir, target)}`);
  const output = join(context.projectRoot, ".biac", "cache", "data", target);
  const outputStats = statFile(output);
  if (outputStats && outputStats.mtimeMs >= statFile(loader)!.mtimeMs) {
    return output;
  }
  await runReported(context, projectDataPath(dataDir, loader), output);
  return output;
}

/** Runs the loader into `output`, logging the outcome either way. */
async function runReported(
  context: LoaderRunContext,
  loader: string,
  output: string,
): Promise<void> {
  const { log } = context;
  const started = performance.now();
  try {
    await runIntoFile(context, loader, output);
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
  context: LoaderRunContext,
  loader: string,
  output: string,
): Promise<void> {
  await mkdir(dirname(output), { recursive: true });
  const temp = `${output}.${process.pid}.tmp`;
  const file = await open(temp, "w");
  try {
    await runLoader(context, loader, file.fd);
  } catch (error) {
    await unlink(temp);
    throw error;
  } finally {
    await file.close();
  }
  await rename(temp, output);
}

/** Runs the loader with its extension's interpreter, from the project root. */
function runLoader(
  context: LoaderRunContext,
  loader: string,
  stdoutFd: number,
): Promise<void> {
  const [command, ...args] = loaderCommand(loader, context.interpreters);
  const child = spawn(command!, args, {
    cwd: context.projectRoot,
    stdio: ["ignore", stdoutFd, "pipe"],
    windowsHide: true,
  });
  const stderrTail = collectStderrTail(child, context.log);
  return new Promise((resolve, reject) => {
    child.on("error", (error: NodeJS.ErrnoException) =>
      reject(
        error.code === "ENOENT" ? missingCommand(loader, command!) : error,
      ),
    );
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new DataLoaderError(loader, code ?? -1, stderrTail()));
    });
  });
}

/** The raw `spawn ENOENT` names neither the loader nor what to install. */
function missingCommand(loader: string, command: string): DataLoaderFailure {
  return new DataLoaderFailure(
    `data loader ${loader} could not start: command ${JSON.stringify(command)} not found on PATH`,
  );
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
