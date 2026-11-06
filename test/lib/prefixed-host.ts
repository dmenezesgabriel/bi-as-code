import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveStaticDir, type StaticDir } from "./static-server.js";

/**
 * Serves a built project the way a GitHub Pages project site does: its
 * contents sit beneath `/<prefix>/` and the origin's root holds only the
 * `extraFiles` (name → body), so a root-absolute URL that ignores the
 * base 404s. `close()` also deletes the directory the host was laid out in;
 * `buildDir` itself is the caller's and is left alone.
 *
 * @example
 * const host = await servePrefixed(join(projectDir, "build"), "bi-as-code");
 * await page.goto(`${host.url}/bi-as-code/`);
 * await host.close();
 */
export async function servePrefixed(
  buildDir: string,
  prefix: string,
  extraFiles: Record<string, string> = {},
): Promise<StaticDir> {
  const hostRoot = mkdtempSync(join(tmpdir(), "biac-prefixed-host-"));
  cpSync(buildDir, join(hostRoot, prefix), { recursive: true });
  for (const [name, body] of Object.entries(extraFiles))
    writeFileSync(join(hostRoot, name), body);
  const host = await serveStaticDir(hostRoot);
  return {
    url: host.url,
    close: async () => {
      await host.close();
      rmSync(hostRoot, { recursive: true, force: true });
    },
  };
}
