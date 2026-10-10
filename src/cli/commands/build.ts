import { join } from "node:path";
import { parseArgs } from "node:util";
import { build as viteBuild } from "vite";
import { pagesPlugin } from "../../engine/pages-plugin.js";
import { resolveProjectRoot, WEB_CONFIG } from "./web-project.js";

export interface BuildOptions {
  /** Directory containing `pages/`; defaults to the current directory. */
  projectRoot: string;
}

export function parseBuildArgs(args: string[]): BuildOptions {
  const { positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {},
  });
  return { projectRoot: resolveProjectRoot("build", positionals) };
}

/**
 * Bundles `projectRoot`'s pages into a static SPA under `<projectRoot>/build`,
 * emptied first so a removed page never lingers in the output.
 *
 * @example
 * // in main.ts: case "build": await build(["site"]);
 */
export async function build(args: string[]): Promise<void> {
  const { projectRoot } = parseBuildArgs(args);
  const outDir = join(projectRoot, "build");
  await viteBuild({
    configFile: WEB_CONFIG,
    plugins: [pagesPlugin(projectRoot)],
    build: { outDir, emptyOutDir: true },
  });
  console.log(`biac build — wrote ${outDir}`);
  // One index.html serves every route: the router resolves the path
  // client-side, so a static host must rewrite unknown paths to it.
  console.log("Static hosts need an SPA rewrite: /* -> /index.html");
}
