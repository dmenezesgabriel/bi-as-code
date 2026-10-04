import {
  execFileSync,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

let projectRoot: string | undefined;
let child: ChildProcessWithoutNullStreams | undefined;

beforeAll(() => {
  // The e2e exercises the shipped artifact: bin/biac runs dist/cli, never
  // src. tsc is invoked through node on a fixed path — no PATH resolution.
  execFileSync(
    process.execPath,
    [
      join(repoRoot, "node_modules/typescript/bin/tsc"),
      "-p",
      "tsconfig.build.json",
    ],
    { cwd: repoRoot, stdio: "pipe" },
  );
  projectRoot = mkdtempSync(join(tmpdir(), "biac-e2e-"));
  mkdirSync(join(projectRoot, "pages"));
  writeFileSync(
    join(projectRoot, "pages/index.md"),
    "---\ntitle: Home\n---\n# Hi\n\n```sql orders\nselect 1\n```\n",
  );
}, 120_000);

afterAll(() => {
  child?.kill("SIGKILL");
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
});

/**
 * Resolves once vite prints its `➜ Local:` block. `--port 0` makes vite bind
 * an OS-assigned ephemeral port, so the advertised URL is the only reliable
 * way to learn it — and proves the user-facing output is truthful.
 */
function waitForUrl(proc: ChildProcessWithoutNullStreams): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const match = /http:\/\/localhost:\d+\//.exec(output);
      if (match) resolve(match[0]);
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.once("exit", (code) =>
      reject(new Error(`biac dev exited ${code} before serving:\n${output}`)),
    );
  });
}

describe("biac dev", () => {
  it("serves the SPA and compiled page modules, then shuts down on SIGINT", async () => {
    child = spawn(process.execPath, [
      join(repoRoot, "bin/biac"),
      "dev",
      projectRoot!,
      "--port",
      "0",
    ]);
    const base = await waitForUrl(child);

    const index = await fetch(base);
    expect(index.status).toBe(200);
    expect(await index.text()).toContain('id="root"');

    // `?import` marks the /@fs request as a JS module import — the same URL
    // shape the manifest's lazy `import()` produces. Without it vite serves
    // the raw markdown instead of running the transform pipeline.
    const page = await fetch(`${base}@fs${projectRoot}/pages/index.md?import`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("export const sqlBlocks");

    child.kill("SIGINT");
    const code = await new Promise<number | null>((resolve) =>
      child!.once("exit", resolve),
    );
    expect(code).toBe(0);
  }, 60_000);
});
