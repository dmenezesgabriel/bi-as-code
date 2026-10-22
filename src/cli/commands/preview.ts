import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { preview as vitePreview, type Plugin } from "vite";
import { loadBiacConfig } from "../../engine/biac-config.js";
import { frameAncestorsMiddleware } from "../../engine/frame-ancestors.js";
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
 * built bundle only — with vite's SPA fallback so deep links reach the
 * client router, and every response carries the project's framing policy
 * (ADR-0022). Returns once listening; SIGINT/SIGTERM close the server.
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
  const { embed } = await loadBiacConfig(projectRoot);
  const server = await vitePreview({
    configFile: WEB_CONFIG,
    build: { outDir },
    plugins: [previewFramingPolicy(embed.origins)],
    preview: port === undefined ? {} : { port },
  });
  console.log(`biac preview — serving ${outDir}`);
  server.printUrls();
  closeOnExitSignals(server);
}

/**
 * Puts the framing policy ahead of vite's preview middlewares. vite's
 * `preview.headers` cannot carry it: vite 8.2.2 answers a matching
 * `If-None-Match` with a bare 304 before applying them, and a cache keeps
 * the stored headers a 304 omits (RFC 9111 §4.3.4) — so a reader who first
 * loaded a page under a longer `embed.origins` would stay framable by an
 * origin since removed.
 *
 * @example
 * vitePreview({ plugins: [previewFramingPolicy(["https://intranet.example.com"])] });
 */
function previewFramingPolicy(origins: readonly string[]): Plugin {
  return {
    name: "biac:preview-framing-policy",
    configurePreviewServer(server) {
      server.middlewares.use(frameAncestorsMiddleware(async () => origins));
    },
  };
}
