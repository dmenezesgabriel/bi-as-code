import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { isDataLoaderSource, listDataLoaderTargets } from "./data-loader.js";
import { discoverPages } from "./discover-pages.js";
import { pageReferences } from "./page-references.js";
import { statFile } from "./stat-file.js";
import type { DataLoaderInterpreters } from "./types.js";

// A scheme (`https:`, `data:`), a protocol-relative `//host`, a `#anchor` /
// `?query` alone, or an empty `src` names no file this project ships.
const NOT_A_LOCAL_FILE = /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?|$)/i;

const DATA_PREFIX = "/data/";

/**
 * Why `src` names no file the built site serves, or `undefined` when it
 * does or is not a local file at all. Only `data/` is served at a path
 * (`/data/<path>`), so a root-relative `src` elsewhere is reported. A
 * relative `src` is rejected for the reason a relative link is
 * (ADR-0034): the browser resolves it against the page URL, whose
 * trailing slash a hand-typed URL may lack. `?query` and `#fragment` are
 * ignored and the rest is %-decoded and matched exactly in case, as the
 * data mount answers a request.
 *
 * @example
 * brokenImageReason("/data/gone.png", new Set()); // → "no file at data/gone.png"
 * brokenImageReason("/data/a.png", new Set(["a.png"])); // → undefined
 */
export function brokenImageReason(
  src: string,
  served: ReadonlySet<string>,
): string | undefined {
  if (NOT_A_LOCAL_FILE.test(src)) return;
  if (!src.startsWith("/")) {
    return "relative sources resolve against the URL's trailing slash; write it /-rooted, e.g. /data/chart.png";
  }
  if (!src.startsWith(DATA_PREFIX)) {
    return "only data/ is served; put the image under data/ and write /data/<file>";
  }
  const path = dataPath(src);
  return served.has(path) ? undefined : `no file at data/${path}`;
}

function dataPath(src: string): string {
  const raw = src.slice(DATA_PREFIX.length).split(/[?#]/, 1)[0]!;
  try {
    return decodeURIComponent(raw);
  } catch {
    // A malformed %-escape names no file; the raw path matches none.
    return raw;
  }
}

/**
 * The posix paths, relative to `data/`, the built site answers: every
 * file `copyDataDir` copies (all but loader sources) plus every output a
 * loader generates.
 *
 * @example
 * servedDataPaths("/site/data", DEFAULT_INTERPRETERS);
 * // → Set { "a.png", "quakes.csv" }
 */
export function servedDataPaths(
  dataDir: string,
  interpreters: DataLoaderInterpreters,
): Set<string> {
  if (!existsSync(dataDir)) return new Set();
  const files = readdirSync(dataDir, { recursive: true, encoding: "utf8" })
    .filter((path) => statFile(join(dataDir, path)) !== null)
    .filter((path) => !isDataLoaderSource(path, interpreters))
    .map((path) => path.split(sep).join("/"));
  return new Set([...files, ...listDataLoaderTargets(dataDir, interpreters)]);
}

/**
 * Fails the build when any page shows an image no file serves, listing
 * every broken image as `pages/<file>:<line> → <src>` with the reason.
 * Runs in `buildStart` beside the link check, before anything is written.
 *
 * @example
 * // in pagesPlugin's buildStart, build only
 * await assertImagesResolve(root, interpreters);
 */
export async function assertImagesResolve(
  projectRoot: string,
  interpreters: DataLoaderInterpreters,
): Promise<void> {
  const served = servedDataPaths(join(projectRoot, "data"), interpreters);
  const perPage = await Promise.all(
    discoverPages(projectRoot).map(({ file }) =>
      brokenImagesOfPage(projectRoot, file, served),
    ),
  );
  const broken = perPage.flat();
  if (broken.length === 0) return;
  throw new Error(
    `${broken.length} broken image${broken.length === 1 ? "" : "s"} — each must name a file biac serves:\n${broken.join("\n")}`,
  );
}

async function brokenImagesOfPage(
  projectRoot: string,
  file: string,
  served: ReadonlySet<string>,
): Promise<string[]> {
  const markdown = await readFile(join(projectRoot, file), "utf8");
  const { images } = await pageReferences(markdown, file);
  return images.flatMap(({ src, line }) => {
    const reason = brokenImageReason(src, served);
    return reason === undefined
      ? []
      : [`  ${file}:${line} → ${src} (${reason})`];
  });
}
