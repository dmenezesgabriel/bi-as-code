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

export interface DevServer {
  /** The URL vite advertised, e.g. "http://localhost:51234/". */
  url: string;
  child: ChildProcessWithoutNullStreams;
  /** Sends SIGINT; resolves with the exit code once the process is gone. */
  stop(): Promise<number | null>;
  kill(): void;
}

/**
 * Spawns `bin/biac dev <projectRoot> --port 0` and resolves once vite prints
 * its `➜ Local:` block. Port 0 binds an OS-assigned ephemeral port, so the
 * advertised URL is the only reliable way to learn it — and proves the
 * user-facing output is truthful.
 *
 * @example
 * const server = await startDevServer(projectRoot);
 * const res = await fetch(server.url); // 200
 * await server.stop();
 */
export function startDevServer(projectRoot: string): Promise<DevServer> {
  const child = spawn(process.execPath, [
    join(repoRoot, "bin/biac"),
    "dev",
    projectRoot,
    "--port",
    "0",
  ]);
  return new Promise((resolve, reject) => {
    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      // Under FORCE_COLOR (playwright workers set it) vite ANSI-wraps the
      // port: "http://localhost:\e[1m45047\e[22m/". Strip escapes so the URL
      // match is color-agnostic.
      const match = /http:\/\/localhost:\d+\//.exec(
        output.replace(/\x1b\[[0-9;]*m/g, ""),
      );
      if (match) resolve(devServer(match[0], child));
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) =>
      reject(new Error(`biac dev exited ${code} before serving:\n${output}`)),
    );
  });
}

function devServer(
  url: string,
  child: ChildProcessWithoutNullStreams,
): DevServer {
  return {
    url,
    child,
    stop: () =>
      new Promise<number | null>((done) => {
        child.once("exit", done);
        child.kill("SIGINT");
      }),
    kill: () => child.kill("SIGKILL"),
  };
}
