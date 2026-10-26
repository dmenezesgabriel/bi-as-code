import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REPO_ROOT = join(import.meta.dirname, "../..");
const TEST_LABEL = "biac-test=serve-image";

// The runtime contract the image must boot under: OWASP Docker Security
// Cheat Sheet rules 3 (drop capabilities), 4 (no privilege escalation) and
// 8 (read-only root).
const HARDENING_FLAGS = [
  "--read-only",
  "--cap-drop",
  "ALL",
  "--security-opt",
  "no-new-privileges:true",
] as const;

/** Exit code and captured output of a docker CLI call that may fail. */
interface DockerOutcome {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** A running hardened container, published on a loopback port. */
export interface RunningServeImage {
  id: string;
  /** `http://127.0.0.1:<host port>` bound to the container's listening port. */
  origin: string;
}

interface ExecFileFailure {
  code?: number | string;
  stdout?: string;
  stderr?: string;
}

/**
 * Runs `docker <args>` and resolves to its outcome whatever the exit code,
 * so callers can assert on a refused boot.
 *
 * @example
 * const { exitCode } = await docker(["version"]);
 */
async function docker(args: readonly string[]): Promise<DockerOutcome> {
  try {
    const { stdout, stderr } = await execFileAsync("docker", args, {
      maxBuffer: 64 * 1024 * 1024,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    const failure = error as ExecFileFailure;
    if (typeof failure.code !== "number") throw error;
    return {
      exitCode: failure.code,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    };
  }
}

/** `docker <args>`, failing loudly with the command and its stderr on a non-zero exit. */
async function dockerOk(args: readonly string[]): Promise<string> {
  const outcome = await docker(args);
  if (outcome.exitCode !== 0) {
    throw new Error(
      `docker ${args.join(" ")} exited ${outcome.exitCode}, expected 0: ${outcome.stderr}`,
    );
  }
  return outcome.stdout.trim();
}

function envFlags(env: Record<string, string>): string[] {
  return Object.entries(env).flatMap(([name, value]) => [
    "-e",
    `${name}=${value}`,
  ]);
}

/**
 * Builds the repo root's Dockerfile into `tag`.
 *
 * @example
 * await buildServeImage("biac-serve:test");
 */
export async function buildServeImage(tag: string): Promise<void> {
  await dockerOk(["build", "--quiet", "-t", tag, REPO_ROOT]);
}

/**
 * Runs `tag` in the foreground under the hardening flags until it exits.
 *
 * @example
 * const { exitCode, stderr } = await runServeImageToExit("biac-serve:test", {});
 */
export function runServeImageToExit(
  tag: string,
  env: Record<string, string>,
): Promise<DockerOutcome> {
  return docker([
    "run",
    "--rm",
    "--label",
    TEST_LABEL,
    ...HARDENING_FLAGS,
    ...envFlags(env),
    tag,
  ]);
}

/**
 * Starts `tag` detached under the hardening flags, publishing
 * `containerPort` on an ephemeral loopback port.
 *
 * @example
 * const { origin } = await startServeImage("biac-serve:test", env, 3000);
 */
export async function startServeImage(
  tag: string,
  env: Record<string, string>,
  containerPort: number,
): Promise<RunningServeImage> {
  const id = await dockerOk([
    "run",
    "-d",
    "--label",
    TEST_LABEL,
    ...HARDENING_FLAGS,
    "-p",
    `127.0.0.1::${containerPort}`,
    ...envFlags(env),
    tag,
  ]);
  const binding = await dockerOk(["port", id, `${containerPort}/tcp`]);
  return { id, origin: `http://${binding.split("\n")[0]}` };
}

/**
 * Runs `command` inside container `id`, resolving whatever its exit code.
 *
 * @example
 * const { stdout } = await execInContainer(id, ["id", "-u"]);
 */
export function execInContainer(
  id: string,
  command: readonly string[],
): Promise<DockerOutcome> {
  return docker(["exec", id, ...command]);
}

/**
 * The container's stdout and stderr so far, interleaved as docker logged them.
 *
 * @example
 * expect(await containerLogs(id)).toContain("auth: basic");
 */
export async function containerLogs(id: string): Promise<string> {
  const { stdout, stderr } = await docker(["logs", id]);
  return stdout + stderr;
}

/**
 * Sends SIGTERM through `docker stop` with a 10 s kill timeout and reports
 * how long the stop took and the exit code PID 1 returned.
 *
 * @example
 * const { elapsedMs, exitCode } = await stopTimed(id);
 */
export async function stopTimed(
  id: string,
): Promise<{ elapsedMs: number; exitCode: number }> {
  const startedAt = Date.now();
  await dockerOk(["stop", "-t", "10", id]);
  const elapsedMs = Date.now() - startedAt;
  const exitCode = Number(
    await dockerOk(["inspect", "-f", "{{.State.ExitCode}}", id]),
  );
  return { elapsedMs, exitCode };
}

/**
 * Force-removes every container these helpers started.
 *
 * @example
 * afterAll(removeServeImageContainers);
 */
export async function removeServeImageContainers(): Promise<void> {
  const ids = await dockerOk(["ps", "-aq", "--filter", `label=${TEST_LABEL}`]);
  if (ids === "") return;
  await dockerOk(["rm", "-f", ...ids.split("\n")]);
}
