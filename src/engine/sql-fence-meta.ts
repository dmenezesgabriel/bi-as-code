/** A named sql fence's info string, split into its name and display flags. */
interface SqlFenceMeta {
  name: string;
  /** Show the fence's SQL source on the page. */
  echo: boolean;
  /** Show the fence's result table on the page. */
  display: boolean;
}

type SqlFenceFlag = "echo" | "display";

const FLAG_TOKEN = /^(echo|display)(?:=(true|false))?$/;

/**
 * Parses the text after ` ```sql ` into the block's positional name and its
 * `echo`/`display` flags: a bare flag or `=true` turns it on, `=false` or no
 * mention leaves it off. Any other token throws, so a typo cannot silently
 * hide a block's output.
 *
 * @example
 * parseSqlFenceMeta("orders echo display=false", "pages/index.md:12");
 * // → { name: "orders", echo: true, display: false }
 */
export function parseSqlFenceMeta(
  meta: string,
  location: string,
): SqlFenceMeta {
  const [name = "", ...attributes] = meta.trim().split(/\s+/);
  assertNameIsNotAttribute(name, location);
  const parsed: SqlFenceMeta = { name, echo: false, display: false };
  for (const token of attributes) {
    const [flag, on] = parseFlag(token, location);
    parsed[flag] = on;
  }
  return parsed;
}

function assertNameIsNotAttribute(name: string, location: string): void {
  // A widget's data="/queries/<path>" names a query file, so a fence name
  // with a leading "/" could never be told apart from one.
  if (name.startsWith("/")) {
    throw new Error(
      `sql block name "${name}" at ${location} starts with "/", which names a query file — write a bare name, e.g. \`sql orders\``,
    );
  }
  if (!FLAG_TOKEN.test(name) && !name.includes("=")) return;
  throw new Error(
    `sql block name "${name}" at ${location} is an attribute — write the name first, e.g. \`sql orders echo\``,
  );
}

function parseFlag(token: string, location: string): [SqlFenceFlag, boolean] {
  const match = FLAG_TOKEN.exec(token);
  if (!match) {
    throw new Error(
      `Unknown sql block attribute "${token}" at ${location} — expected echo or display, bare or =true/=false`,
    );
  }
  return [match[1] as SqlFenceFlag, match[2] !== "false"];
}
