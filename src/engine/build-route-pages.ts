import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { discoverPages } from "./discover-pages.js";

/**
 * The top-level names the build output owns: `assets/` (vite's hashed
 * bundles), `data/` (the copied data tree), `widgets/` (the exported
 * widget modules), and the files `index.html` (the shell), `404.html`
 * (the error-document copy) and `favicon.svg` (the web project's public
 * dir). A page route starting with one would copy the shell into or onto
 * that output — and the route is shadowed anyway, since dev mounts /data
 * and preview mounts /widgets.
 */
const RESERVED_OUTPUT_PATHS: ReadonlySet<string> = new Set([
  "assets",
  "data",
  "widgets",
  "favicon.svg",
  "index.html",
  "404.html",
]);

/**
 * Fails the build when a page route's first segment is a name the build
 * output owns — the shell copy for such a route would land inside a build
 * directory or on top of an emitted file. Runs in `buildStart`, before
 * anything is written, so the failure leaves no half-written build/.
 *
 * @example
 * // in pagesPlugin's buildStart, build only
 * assertRoutesBuildable(root);
 */
export function assertRoutesBuildable(projectRoot: string): void {
  for (const entry of discoverPages(projectRoot)) {
    const segment = entry.route.split("/")[1];
    if (segment === undefined || !RESERVED_OUTPUT_PATHS.has(segment)) continue;
    throw new Error(
      `Reserved route "${entry.route}" from "${entry.file}" — the build output owns the first segment "${segment}"; move the page out of pages/${segment}/ or rename it`,
    );
  }
}

/**
 * Copies the emitted shell to `<route>/index.html` for every discovered
 * route and to `404.html`, byte-identical (ADR-0029). A static host with
 * no rewrite rule then answers every deep link with the shell — an index
 * document at every folder level is what S3 website endpoints, GitHub
 * Pages and Garage serve — and the client renders the route as today. The
 * shell's asset refs are root-absolute, so a copy one level deep resolves
 * them from the origin root; no per-copy rewriting.
 *
 * @example
 * // in pagesPlugin's writeBundle, after the data/ copies
 * await copyShellToRoutes(dir, root);
 */
export async function copyShellToRoutes(
  outDir: string,
  projectRoot: string,
): Promise<void> {
  const shellPath = join(outDir, "index.html");
  let shell: Buffer;
  try {
    shell = await readFile(shellPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    throw new Error(
      `biac:pages wrote no index.html to ${outDir} — the route copies need the emitted shell`,
    );
  }
  await writeFile(join(outDir, "404.html"), shell);
  for (const entry of discoverPages(projectRoot)) {
    if (entry.route === "/") continue;
    const target = join(
      outDir,
      ...entry.route.split("/").filter(Boolean),
      "index.html",
    );
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, shell);
  }
}
