import type { Page } from "@playwright/test";
import {
  formatBlankPageReport,
  probeRequest,
  type UnansweredRequest,
} from "../lib/request-probe.js";

/** Long enough for a loaded host's slowest transform, short of a teardown. */
const PROBE_TIMEOUT_MS = 10_000;

/**
 * Records every request `page` issues until it finishes or fails, and returns
 * a reader for the ones still open. Wire it before the first `page.goto`. The
 * HMR websocket is not an HTTP request, so it never shows up. A main-frame
 * navigation forgets the previous document's requests: Chromium cancels them
 * without always firing `requestfailed`, and a reload (vite's full reload
 * included) would otherwise report them as unanswered forever.
 *
 * @example
 * const unanswered = trackPendingRequests(page);
 * await page.goto(url);
 * unanswered(); // [{ url, startedAt }] for each module still in flight
 */
export function trackPendingRequests(page: Page): () => UnansweredRequest[] {
  const pending = new Map<object, UnansweredRequest>();
  page.on("request", (request) =>
    pending.set(request, { url: request.url(), startedAt: Date.now() }),
  );
  page.on("requestfinished", (request) => pending.delete(request));
  page.on("requestfailed", (request) => pending.delete(request));
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) pending.clear();
  });
  return () => [...pending.values()];
}

/**
 * True when `page` loaded a document over HTTP but its `#root` holds nothing —
 * the app never mounted. A closed or crashed page reads as false: there is no
 * document left to call blank.
 */
export async function rootIsEmpty(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(
      () =>
        location.protocol.startsWith("http") &&
        !document.getElementById("root")?.hasChildNodes(),
    );
  } catch {
    return false;
  }
}

/**
 * Re-requests each unanswered URL from node against the still-running server
 * and formats the result with the page's errors and the server's log — see
 * `formatBlankPageReport`.
 *
 * @example
 * const report = await describeBlankPage(unanswered(), errors, server.log());
 */
export async function describeBlankPage(
  unanswered: readonly UnansweredRequest[],
  pageErrors: readonly string[],
  serverLog: readonly string[],
): Promise<string> {
  const takenAt = Date.now();
  const probes = await Promise.all(
    unanswered.map((request) => probeRequest(request.url, PROBE_TIMEOUT_MS)),
  );
  return formatBlankPageReport({
    unanswered,
    probes,
    takenAt,
    pageErrors,
    serverLog,
  });
}
