import { readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { Connect, Plugin } from "vite";

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

/** The build path a pathname names, or `undefined` when it escapes `outDir`. */
function insideBuild(outDir: string, pathname: string): string | undefined {
  const resolved = resolve(outDir, `.${decodeURIComponent(pathname)}`);
  if (resolved.startsWith(`${resolve(outDir)}${sep}`)) return resolved;
}

function readNotFoundPage(outDir: string): string | undefined {
  try {
    return readFileSync(join(outDir, "404.html"), "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Settles a request vite's static server and `index.html` fallback both
 * missed, the way a rewrite-less static host does: a route directory asked
 * for without its trailing slash gets a `301` to the slash form (query kept),
 * and anything else gets `404` with the build's own `404.html`. A file vite
 * rewrote but has not yet served, and a build with no `404.html`, pass on.
 * `base` is the normalised deploy prefix (leading and trailing `/`): vite
 * strips it from `req.url` before this runs, so the redirect puts it back.
 *
 * @example
 * server.middlewares.use(serveRoutesMiddleware("/site/build", "/sales/"));
 */
export function serveRoutesMiddleware(
  outDir: string,
  base: string,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const { pathname, search } = new URL(req.url ?? "/", "http://serve.test");
    const target = insideBuild(outDir, pathname);
    // htmlFallback rewrites `/route/` to `/route/index.html` without serving
    // it; vite's index.html middleware, which runs after this one, does.
    if (target !== undefined && isFile(target)) return next();
    if (
      target !== undefined &&
      !pathname.endsWith("/") &&
      isFile(join(target, "index.html"))
    ) {
      res.statusCode = 301;
      res.setHeader("Location", `${base.slice(0, -1)}${pathname}/${search}`);
      res.end();
      return;
    }
    const page = readNotFoundPage(outDir);
    if (page === undefined) return next();
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(req.method === "HEAD" ? undefined : page);
  };
}

/**
 * Mounts `serveRoutesMiddleware` as a preview post-hook: vite runs those after
 * its static server and `index.html` fallback, so the middleware sees only
 * requests nothing matched, with `base` already stripped from `req.url`.
 *
 * @example
 * vitePreview({ plugins: [serveRoutesPlugin("/site/build", "/sales/")] });
 */
export function serveRoutesPlugin(outDir: string, base: string): Plugin {
  return {
    name: "biac:serve-routes",
    configurePreviewServer(server) {
      return () => {
        server.middlewares.use(serveRoutesMiddleware(outDir, base));
      };
    },
  };
}
