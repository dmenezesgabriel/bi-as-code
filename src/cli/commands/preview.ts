import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { preview as vitePreview } from "vite";
import { loadBiacConfig } from "../../engine/biac-config.js";
import { staticHostPlugins } from "./static-plugins.js";
import {
  closeOnExitSignals,
  parsePort,
  resolveProjectRoot,
  WEB_CONFIG,
} from "./web-project.js";

export interface PreviewOptions {
  /** Directory whose `build/` is served; defaults to the current directory. */
  projectRoot: string;
  /** Override for vite's preview port (4173); 0 binds an ephemeral port. */
  port?: number;
}

export function parsePreviewArgs(args: string[]): PreviewOptions {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { port: { type: "string" } },
  });
  return {
    projectRoot: resolveProjectRoot("preview", positionals),
    port: parsePort(values.port),
  };
}

/**
 * Serves `<projectRoot>/build` as a static site — no page compilation, the
 * built bundle only — under the `base` `biac.config.ts` deploys it at:
 * vite redirects `/` into it and answers nothing outside it. The SPA
 * fallback reaches deep links, every response carries the project's
 * framing policy (ADR-0022), and data files carry their media type and,
 * like the exported widget modules, answer only the origins
 * `embed.dataOrigins` lists (ADR-0025, ADR-0027). Returns once listening;
 * SIGINT/SIGTERM close the server.
 *
 * @example
 * // in main.ts: case "preview": await preview(["site", "--port", "0"]);
 */
export async function preview(args: string[]): Promise<void> {
  const { projectRoot, port } = parsePreviewArgs(args);
  const outDir = join(projectRoot, "build");
  // vite's own missing-dir check only fires for its `vite preview` binary,
  // so without this a missing build serves 404s instead of failing.
  if (!existsSync(outDir)) {
    throw new Error(
      `biac preview: no build at ${outDir} — run \`biac build\` first`,
    );
  }
  // Read once: a preview serves a finished build, so a config edit takes a
  // restart, as a rebuild does.
  const { embed, base } = await loadBiacConfig(projectRoot);
  const server = await vitePreview({
    configFile: WEB_CONFIG,
    base,
    build: { outDir },
    plugins: staticHostPlugins(base, outDir, embed),
    // vite's default CORS rule lets every loopback origin read every
    // response; the listed origins on `/data/` are the only rule (ADR-0025).
    preview: { cors: false, ...(port === undefined ? {} : { port }) },
  });
  console.log(`biac preview — serving ${outDir}`);
  server.printUrls();
  closeOnExitSignals(server);
}
