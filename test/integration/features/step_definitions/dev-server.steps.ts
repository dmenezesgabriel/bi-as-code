import assert from "node:assert/strict";
import {
  execFileSync,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { After, BeforeAll, Given, Then, When } from "@cucumber/cucumber";
// .ts specifier, not .js — Node's type stripping resolves the real file.
import { eventually, getOk } from "../../../lib/http.ts";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
// Joined onto `base`, which already ends in "/" — a leading slash here
// would produce `//@id/…`, miss vite's module route and hit the SPA
// fallback instead.
const MANIFEST_URL = "@id/virtual:biac-pages";
const NESTED_PAGE_SOURCE_URL = "__biac/page-source/nested/page.md";

let projectRoot: string | undefined;
let child: ChildProcessWithoutNullStreams | undefined;
let base: string | undefined;

BeforeAll(() => {
  // bin/biac runs dist/, never src — build once for the whole feature run.
  execFileSync(
    process.execPath,
    [
      join(repoRoot, "node_modules/typescript/bin/tsc"),
      "-p",
      "tsconfig.build.json",
    ],
    { cwd: repoRoot, stdio: "pipe" },
  );
});

After(async () => {
  child?.kill("SIGKILL");
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  child = undefined;
  projectRoot = undefined;
  base = undefined;
});

/**
 * Finds an OS-assigned free port by listening on 0, then releases it. A
 * small race against other processes exists; strictPort failing the spawn
 * surfaces as a fetch timeout, which is loud enough for a test.
 */
async function freePort(): Promise<number> {
  const probe = createServer().listen(0);
  await new Promise<void>((resolve) => probe.once("listening", resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

Given("a project with an index page and a nested page", () => {
  projectRoot = mkdtempSync(join(tmpdir(), "biac-cucumber-"));
  mkdirSync(join(projectRoot, "pages/nested"), { recursive: true });
  writeFileSync(
    join(projectRoot, "pages/index.md"),
    "---\ntitle: Home\n---\n# Hi\n\n```sql orders\nselect 1\n```\n",
  );
  writeFileSync(join(projectRoot, "pages/nested/page.md"), "# Nested\n");
});

When("I start the dev server", async () => {
  assert.ok(projectRoot, "project must exist before starting the server");
  const port = await freePort();
  base = `http://localhost:${port}/`;
  child = spawn(process.execPath, [
    join(repoRoot, "bin/biac"),
    "dev",
    projectRoot,
    "--port",
    String(port),
  ]);
  await eventually(async () => {
    const res = await fetch(base!);
    return res.status === 200;
  });
});

Then("the root URL serves the SPA shell", async () => {
  assert.match(await getOk(base!), /id="root"/);
});

Then("the index page module compiles its title and sql block", async () => {
  const code = await getOk(`${base}@fs${projectRoot}/pages/index.md?import`);
  assert.match(code, /export const title = "Home";/);
  assert.match(code, /export const sqlBlocks = \[\{"name":"orders"/);
});

Then("the page manifest lists the index and nested routes", async () => {
  const code = await getOk(`${base}${MANIFEST_URL}`);
  assert.match(code, /route: "\/"/);
  assert.match(code, /route: "\/nested\/page"/);
});

When("I add a page file to the project", () => {
  assert.ok(projectRoot, "project must exist");
  writeFileSync(join(projectRoot, "pages/added.md"), "# Added later\n");
});

Then("the page manifest serves the new route", async () => {
  await eventually(async () =>
    (await getOk(`${base}${MANIFEST_URL}`)).includes('"/added"'),
  );
});

When("I save {string} as the nested page's source", async (heading: string) => {
  const res = await fetch(`${base}${NESTED_PAGE_SOURCE_URL}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: `${heading}\n` }),
  });
  assert.equal(res.status, 204);
});

Then("the nested page file on disk reads {string}", (heading: string) => {
  const onDisk = readFileSync(join(projectRoot!, "pages/nested/page.md"));
  assert.equal(onDisk.toString(), `${heading}\n`);
});

Then("the nested page module compiles {string}", async (text: string) => {
  const url = `${base}@fs${projectRoot}/pages/nested/page.md?import`;
  await eventually(async () => (await getOk(url)).includes(text));
});

Then(
  "the nested page module reports the compile error {string}",
  async (message: string) => {
    const url = `${base}@fs${projectRoot}/pages/nested/page.md?import`;
    // The module carries the error as JSON, so its quotes arrive escaped.
    const served = JSON.stringify(message).slice(1, -1);
    await eventually(async () => {
      const code = await getOk(url);
      return (
        code.startsWith("export const compileError") && code.includes(served)
      );
    });
  },
);

Then("the dev server exits cleanly on SIGINT", async () => {
  assert.ok(child, "server must be running");
  const code = await new Promise<number | null>((resolve) => {
    child!.once("exit", resolve);
    child!.kill("SIGINT");
  });
  assert.equal(code, 0);
});

Then("the nested page's edit URL serves the SPA shell", async () => {
  assert.match(await getOk(`${base}nested/page?edit=true`), /id="root"/);
});

Then("the dev server compiles the page editor module", async () => {
  // Served from the vite root (src/web): the editor loads lazily on `?edit`,
  // so this is the request the browser makes when the editor opens.
  const editor = await getOk(`${base}src/features/editor/page-editor.tsx`);
  assert.match(editor, /export function PageEditor/);
  assert.match(editor, /from "\/src\/features\/editor\/code-editor\.tsx"/);
  // CodeMirror reaches the browser as a vite-optimized dependency.
  const codeEditor = await getOk(`${base}src/features/editor/code-editor.tsx`);
  assert.match(codeEditor, /\/node_modules\/\.vite\/deps\/codemirror\.js/);
});
