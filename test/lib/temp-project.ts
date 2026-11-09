import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const created: string[] = [];

/**
 * Creates a temp project root tracked for {@link cleanupProjects} — suites
 * call cleanup in `afterEach` so fixture dirs are removed even on failure.
 *
 * @example
 * const root = makeProject("biac-pages-");
 * writeProjectFile(root, "pages/index.md", "# Hi\n");
 *
 * `parent` defaults to the OS temp dir, which is RAM on some hosts; pass a
 * disk path for bulk such as an installed `node_modules`.
 */
export function makeTempProject(
  prefix = "biac-site-",
  parent: string = tmpdir(),
): string {
  const root = mkdtempSync(join(parent, prefix));
  created.push(root);
  return root;
}

/** Writes `content` to `relativePath` under `root`, creating parent dirs. */
export function writeProjectFile(
  root: string,
  relativePath: string,
  content: string | Buffer,
): void {
  const file = join(root, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/** Removes every root made by {@link makeTempProject} since the last cleanup. */
export function cleanupProjects(): void {
  while (created.length > 0) {
    rmSync(created.pop()!, { recursive: true, force: true });
  }
}
