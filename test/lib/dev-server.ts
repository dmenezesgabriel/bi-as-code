import {
  execFileSync,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Compiles `src/cli`+`src/engine` into `dist/` — `bin/biac` runs the built
 * output, never `src`, so every tier that spawns the CLI builds it first.
 * tsc is invoked through `process.execPath` on a fixed path — no PATH
 * resolution for a toolchain binary.
 */
export function buildCli(): void {
  execFileSync(
    process.execPath,
    [
      join(repoRoot, "node_modules/typescript/bin/tsc"),
      "-p",
      "tsconfig.build.json",
    ],
    { cwd: repoRoot, stdio: "pipe" },
  );
}

/**
 * Runs `bin/biac build <projectRoot>`, writing `<projectRoot>/build` — the
 * folder `biac preview` serves. Throws on a non-zero exit.
 *
 * @example
 * buildProject(projectRoot);
 * const server = await startBiacServer("preview", projectRoot);
 */
export function buildProject(projectRoot: string): void {
  execFileSync(
    process.execPath,
    [join(repoRoot, "bin/biac"), "build", projectRoot],
    {
      stdio: "pipe",
    },
  );
}

export interface DevServer {
  /** The URL vite advertised, e.g. "http://localhost:51234/". */
  url: string;
  child: ChildProcessWithoutNullStreams;
  /**
   * Every line the server has written so far, from spawn on, as
   * "<ISO time> <stdout|stderr> <text>" with ANSI escapes stripped — the
   * evidence a failed test reads after the fact.
   */
  log(): readonly string[];
  /** Sends SIGINT; resolves with the exit code once the process is gone. */
  stop(): Promise<number | null>;
  kill(): void;
}

/**
 * Spawns `bin/biac dev <projectRoot> --port 0`; see {@link startBiacServer}.
 * `extraEnvironment` adds variables to the child only, e.g. vite's `DEBUG`.
 *
 * @example
 * const server = await startDevServer(projectRoot);
 * const res = await fetch(server.url); // 200
 * await server.stop();
 */
export function startDevServer(
  projectRoot: string,
  extraEnvironment: NodeJS.ProcessEnv = {},
): Promise<DevServer> {
  return startBiacServer("dev", projectRoot, extraEnvironment);
}

/**
 * Spawns `bin/biac <command> <projectRoot> --port 0` and resolves once vite
 * prints its `➜ Local:` block. Port 0 binds an OS-assigned ephemeral port, so
 * the advertised URL is the only reliable way to learn it — and proves the
 * user-facing output is truthful. `biac serve` advertises its loopback
 * address, not `localhost`; `extraArguments` follow `--port 0`, e.g.
 * `["--host", "0.0.0.0"]`. `biacBin` runs an installed copy of the CLI
 * instead of this repo's.
 *
 * @example
 * const server = await startBiacServer("preview", projectRoot);
 * await fetch(`${server.url}weekly-review`); // 200
 * await server.stop();
 */
export function startBiacServer(
  command: "dev" | "preview" | "serve",
  projectRoot: string,
  extraEnvironment: NodeJS.ProcessEnv = {},
  extraArguments: readonly string[] = [],
  biacBin: string = join(repoRoot, "bin/biac"),
): Promise<DevServer> {
  const child = spawn(
    process.execPath,
    [biacBin, command, projectRoot, "--port", "0", ...extraArguments],
    { env: { ...environmentWithoutNodeEnv(), ...extraEnvironment } },
  );
  const log = recordLog(child);
  return new Promise((resolve, reject) => {
    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const match = /http:\/\/(?:localhost|127\.0\.0\.1):\d+\//.exec(
        stripAnsi(output),
      );
      if (match) resolve(devServer(match[0], child, log));
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) =>
      reject(
        new Error(`biac ${command} exited ${code} before serving:\n${output}`),
      ),
    );
  });
}

/**
 * Collects the child's output for its whole life — a passing server's log
 * is otherwise never seen, and a hung request is diagnosed from it.
 */
function recordLog(child: ChildProcessWithoutNullStreams): string[] {
  const log: string[] = [];
  child.stdout.on("data", (chunk: Buffer) =>
    log.push(...timestampedLines(chunk, "stdout")),
  );
  child.stderr.on("data", (chunk: Buffer) =>
    log.push(...timestampedLines(chunk, "stderr")),
  );
  return log;
}

function timestampedLines(chunk: Buffer, stream: string): string[] {
  const time = new Date().toISOString();
  return stripAnsi(chunk.toString())
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => `${time} ${stream} ${line}`);
}

/**
 * Under FORCE_COLOR (playwright workers set it) vite ANSI-wraps the port:
 * "http://localhost:\e[1m45047\e[22m/". Escapes are stripped so the URL
 * match and the log read color-agnostic.
 */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * This process's environment minus `NODE_ENV`, which vitest sets to "test".
 * vite hashes `process.env.NODE_ENV || mode` into the dep cache's
 * `configHash` (`getConfigHash`, vite's deps optimizer), and every project's
 * `biac dev` shares `src/web/node_modules/.vite`. A child that inherited
 * "test" would hash differently from a user's shell, drop the cache their
 * next `biac dev` starts warm from, and leak a `deps_temp_*` dir when stopped
 * mid-optimize. Unset, not "development", because unset is what a shell has.
 */
function environmentWithoutNodeEnv(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment.NODE_ENV;
  return environment;
}

function devServer(
  url: string,
  child: ChildProcessWithoutNullStreams,
  log: readonly string[],
): DevServer {
  return {
    url,
    child,
    log: () => log,
    stop: () =>
      new Promise<number | null>((done) => {
        child.once("exit", done);
        child.kill("SIGINT");
      }),
    kill: () => child.kill("SIGKILL"),
  };
}
