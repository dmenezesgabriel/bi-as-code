import { spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCli, startDevServer } from "../lib/dev-server.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
// `biac dev` serves `src/web` as vite's root, so every project shares this
// dep cache — the one a user's next `bin/biac dev` starts warm from.
const sharedCacheDir = join(repoRoot, "src/web/node_modules/.vite");
// `DEBUG=vite:deps` lines: a warm start skips, a cold one commits.
const OPTIMIZER_SETTLED = /Hash is consistent|dependencies optimized/;

let projectRoot: string | undefined;

function tempDirCount(): number {
  return readdirSync(sharedCacheDir).filter((name) =>
    name.startsWith("deps_temp_"),
  ).length;
}

function committedConfigHash(): string {
  const metadata = readFileSync(
    join(sharedCacheDir, "deps/_metadata.json"),
    "utf8",
  );
  return (JSON.parse(metadata) as { configHash: string }).configHash;
}

/**
 * Runs `bin/biac dev` as a user's shell does — no `NODE_ENV` — until its
 * optimizer has settled the shared cache, then stops it. Spelled out here
 * rather than shared with the helper under test, so the two cannot agree
 * by construction.
 */
function warmCacheLikeAShell(root: string): Promise<void> {
  const shellEnv: NodeJS.ProcessEnv = { ...process.env, DEBUG: "vite:deps" };
  delete shellEnv.NODE_ENV;
  const child = spawn(
    process.execPath,
    [join(repoRoot, "bin/biac"), "dev", root, "--port", "0"],
    { env: shellEnv },
  );
  return new Promise((resolve, reject) => {
    let output = "";
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (OPTIMIZER_SETTLED.test(output)) child.kill("SIGINT");
    });
    child.once("exit", () =>
      OPTIMIZER_SETTLED.test(output)
        ? resolve()
        : reject(
            new Error(
              `expected the optimizer to settle before exit, got:\n${output}`,
            ),
          ),
    );
  });
}

beforeAll(async () => {
  buildCli();
  projectRoot = mkdtempSync(join(tmpdir(), "biac-e2e-cache-"));
  mkdirSync(join(projectRoot, "pages"));
  writeFileSync(join(projectRoot, "pages/index.md"), "# Hi\n");
  await warmCacheLikeAShell(projectRoot);
}, 180_000);

afterAll(() => {
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
});

describe("a test-spawned biac dev", () => {
  it("reuses the dep cache a user's biac dev wrote, leaving no temp dir", async () => {
    const tempDirsBefore = tempDirCount();
    const hashBefore = committedConfigHash();

    const server = await startDevServer(projectRoot!);
    await server.stop();

    expect(tempDirCount()).toBe(tempDirsBefore);
    expect(committedConfigHash()).toBe(hashBefore);
  }, 60_000);
});
