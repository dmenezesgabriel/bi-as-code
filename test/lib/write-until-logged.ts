import { setTimeout as sleep } from "node:timers/promises";

export interface RewriteUntilServerLogsOptions {
  /** Writes the file once; called again only while no acknowledgment came. */
  rewrite(): void;
  /** The dev server's log so far, e.g. `DevServer.log`. */
  log(): readonly string[];
  /**
   * The tail of the path vite logs for this write: the file itself for a
   * reload ("biac.config.ts", "pages/a.md"), the accepting module for an
   * in-place swap ("/@id/__x00__virtual:biac-pages" for a page edit).
   */
  loggedPath: string;
  /** How long one write may go unacknowledged before it is written again. */
  attemptMs: number;
  /** Total budget; past it the call throws. */
  timeoutMs: number;
}

const POLL_MS = 50;

/**
 * A content edit swaps the page in place, and vite logs that as an update
 * of the module accepting it — the page manifest — not of the page file.
 */
export const PAGE_SWAP_LOGGED_PATH = "/@id/__x00__virtual:biac-pages";

/**
 * vite 8.2.2 logs a watched file's change as `page reload <file>[ (reason)]`,
 * the path relative to its root, or absolute when outside it — `biac dev`'s
 * root is not the project dir, so only the tail is matched — or, when the
 * change swaps in place, as `hmr update <url>[, <url>…]` naming the modules
 * that accept it, not the file (`updateModules` in vite's
 * `dist/node/chunks/node.js` logs each boundary's url).
 */
const ACKNOWLEDGMENT_PREFIX = /page reload|hmr update/;

/**
 * Writes a file under `biac dev` until the server logs that it saw the
 * write, then never again — a rewrite after that would restart the reload
 * the caller is about to wait on. Resolves with the acknowledging log line.
 *
 * @example
 * await rewriteUntilServerLogs({
 *   rewrite: () => writeFileSync(configFile, source),
 *   log: biacDev.log,
 *   loggedPath: "biac.config.ts",
 *   attemptMs: 3_000,
 *   timeoutMs: 20_000,
 * });
 */
export async function rewriteUntilServerLogs(
  options: RewriteUntilServerLogsOptions,
): Promise<string> {
  const from = options.log().length;
  const deadline = Date.now() + options.timeoutMs;
  while (Date.now() < deadline) {
    options.rewrite();
    const line = await awaitAcknowledgment(options, from, deadline);
    if (line) return line;
  }
  throw new Error(
    `${options.loggedPath} was never acknowledged: no ` +
      `"${ACKNOWLEDGMENT_PREFIX.source} …${options.loggedPath}" line in ` +
      `${options.timeoutMs} ms; the server's last lines:\n` +
      options.log().slice(-10).join("\n"),
  );
}

async function awaitAcknowledgment(
  options: RewriteUntilServerLogsOptions,
  from: number,
  deadline: number,
): Promise<string | undefined> {
  const attemptEnd = Math.min(Date.now() + options.attemptMs, deadline);
  const pattern = acknowledgmentPattern(options.loggedPath);
  while (Date.now() < attemptEnd) {
    const line = options
      .log()
      .slice(from)
      .find((entry) => pattern.test(entry));
    if (line) return line;
    await sleep(POLL_MS);
  }
  return undefined;
}

function acknowledgmentPattern(loggedPath: string): RegExp {
  const escaped = loggedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:${ACKNOWLEDGMENT_PREFIX.source})(?:\\s|.*[\\s/])${escaped}(?:$|[\\s,])`,
  );
}
