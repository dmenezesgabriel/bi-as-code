import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { preview as vitePreview, type Plugin } from "vite";
import { loadBiacConfig } from "../../engine/biac-config.js";
import { dataCorsMiddleware } from "../../engine/data-cors.js";
import { dataMediaTypeMiddleware } from "../../engine/data-media-type.js";
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
    plugins: [
      previewFramingPolicy(embed.origins),
      // configurePreviewServer middlewares run before vite strips the base
      // (measured on vite 8.2.2), so req.url still carries the prefix and
      // the /data and /widgets mounts go on the full prefixed path.
      previewDataCors(base, embed.dataOrigins),
      previewModuleCors(base, embed.dataOrigins),
      previewDataMediaTypes(base, join(outDir, "data")),
    ],
    // vite's default CORS rule lets every loopback origin read every
    // response; the listed origins on `/data/` are the only rule (ADR-0025).
    preview: { cors: false, ...(port === undefined ? {} : { port }) },
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

/**
 * Answers the listed origins on `build/data/` under `base` ahead of vite's
 * preview middlewares, so a 304 carries the headers too — the reason
 * `previewFramingPolicy` is a middleware.
 *
 * @example
 * vitePreview({ plugins: [previewDataCors("/bi-as-code/", ["https://notebook.example.com"])] });
 */
function previewDataCors(base: string, origins: readonly string[]): Plugin {
  return {
    name: "biac:preview-data-cors",
    configurePreviewServer(server) {
      server.middlewares.use(
        `${base}data`,
        dataCorsMiddleware(async () => origins),
      );
    },
  };
}

/**
 * Answers the listed origins on `build/widgets/` — the exported widget
 * modules. A cross-origin `<script type="module">` import is a CORS fetch:
 * without `Access-Control-Allow-Origin` echoing the host's origin the
 * browser refuses the module outright. The grant is `embed.dataOrigins`
 * itself — the module's queries read `/data/` under the same list, so a
 * module-only origin could import but never render (ADR-0027).
 *
 * @example
 * vitePreview({ plugins: [previewModuleCors("/bi-as-code/", ["https://notebook.example.com"])] });
 */
function previewModuleCors(base: string, origins: readonly string[]): Plugin {
  return {
    name: "biac:preview-module-cors",
    configurePreviewServer(server) {
      server.middlewares.use(
        `${base}widgets`,
        dataCorsMiddleware(async () => origins),
      );
    },
  };
}

/**
 * Types `build/data/` files under `base` ahead of vite's preview
 * middlewares, whose built-in table leaves parquet and arrow untyped.
 *
 * @example
 * vitePreview({ plugins: [previewDataMediaTypes("/bi-as-code/", "/site/build/data")] });
 */
function previewDataMediaTypes(base: string, dataDir: string): Plugin {
  return {
    name: "biac:preview-data-media-types",
    configurePreviewServer(server) {
      server.middlewares.use(`${base}data`, dataMediaTypeMiddleware(dataDir));
    },
  };
}
