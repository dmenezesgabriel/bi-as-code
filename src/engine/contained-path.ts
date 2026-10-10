import { resolve, sep } from "node:path";

/**
 * The decoded pathname of a mounted middleware's `req.url` — query and
 * fragment dropped. `null` on malformed escapes (`%zz`): the request itself
 * is bad, so callers answer 400.
 *
 * @example
 * decodePathname("/a%20b.md?t=1"); // → "/a b.md"
 */
export function decodePathname(url: string | undefined): string | null {
  const raw = (url ?? "/").split(/[?#]/, 1)[0]!;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/**
 * Resolves a decoded request pathname under `root`, or `null` when it
 * escapes `root` (`/../x`, encoded or not) — callers answer 403. `root`
 * itself counts as contained.
 *
 * @example
 * resolveContained("/site/data", "/a.csv"); // → "/site/data/a.csv"
 * resolveContained("/site/data", "/../x"); // → null
 */
export function resolveContained(
  root: string,
  pathname: string,
): string | null {
  const base = resolve(root);
  const file = resolve(base, `.${pathname}`);
  if (file !== base && !file.startsWith(`${base}${sep}`)) return null;
  return file;
}
