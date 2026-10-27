import { readFileSync } from "node:fs";

/**
 * vite's bundled chokidar emits one `change` per path per 50 ms and drops
 * the rest (`_throttle(EV_CHANGE, path, 50)` in
 * `vite/dist/node/chunks/node.js`, vite 8.2.2): a file written twice inside
 * that window reports only the first write.
 */
export const WATCHER_CHANGE_THROTTLE_MS = 50;

// Past the window, so a write the throttle dropped has already landed.
const RECHECK_DELAY_MS = WATCHER_CHANGE_THROTTLE_MS + 10;

export type Schedule = (callback: () => void, delayMs: number) => unknown;

// Unref'd: a recheck still pending when the server closes must not hold the
// process open.
const scheduleUnref: Schedule = (callback, delayMs) =>
  setTimeout(callback, delayMs).unref();

/**
 * Called as a reported write is handled: reads the file now and again once
 * the watcher's throttle window has closed, and calls `onMissedWrite` if the
 * text moved in between — a write whose `change` event chokidar dropped.
 *
 * @example
 * recheckAfterWatcherThrottle(() => fileText(configFile), () => reload());
 */
export function recheckAfterWatcherThrottle(
  readSource: () => string | undefined,
  onMissedWrite: () => void,
  schedule: Schedule = scheduleUnref,
): void {
  const seen = readSource();
  schedule(() => {
    if (readSource() !== seen) onMissedWrite();
  }, RECHECK_DELAY_MS);
}

/**
 * A file's text, or `undefined` once it is gone — a deletion inside the
 * window is a missed write too.
 *
 * @example
 * fileText("/site/biac.config.ts"); // "export default {};\n"
 */
export function fileText(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
