import { join } from "node:path";
import type { Plugin } from "vite";
import { dataCorsMiddleware } from "../../engine/data-cors.js";
import { dataMediaTypeMiddleware } from "../../engine/data-media-type.js";
import { frameAncestorsMiddleware } from "../../engine/frame-ancestors.js";

/** The `embed` slice of `biac.config.ts` the static plugins read. */
export interface EmbedGrants {
  readonly origins: readonly string[];
  readonly dataOrigins: readonly string[];
}

/**
 * The plugins both `biac preview` and `biac serve` mount ahead of vite's
 * static server: framing policy, data and widget CORS grants, and data media
 * types. Order is part of the contract — the framing policy goes first.
 *
 * @example
 * vitePreview({ plugins: staticHostPlugins("/", "/site/build", embed) });
 */
export function staticHostPlugins(
  base: string,
  outDir: string,
  embed: EmbedGrants,
): Plugin[] {
  return [
    previewFramingPolicy(embed.origins),
    // configurePreviewServer middlewares run before vite strips the base
    // (measured on vite 8.2.2), so req.url still carries the prefix and
    // the /data and /widgets mounts go on the full prefixed path.
    previewDataCors(base, embed.dataOrigins),
    previewModuleCors(base, embed.dataOrigins),
    previewDataMediaTypes(base, join(outDir, "data")),
  ];
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
