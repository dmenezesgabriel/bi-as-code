import type { Page, Request } from "@playwright/test";
import {
  formatBlankPageReport,
  probeRequest,
  type FailedRequest,
  type UnansweredRequest,
} from "../lib/request-probe.js";

/** Long enough for a loaded host's slowest transform, short of a teardown. */
const PROBE_TIMEOUT_MS = 10_000;

/** Readers over a page's requests that never completed. */
export interface PageRequests {
  /** Issued and still waiting on an answer. */
  unanswered(): UnansweredRequest[];
  /** Given up on by Chrome, with its `net::ERR_…` reason. */
  failed(): FailedRequest[];
}

/**
 * Records every request `page` issues until it finishes, and keeps the ones
 * still open and the ones Chrome gave up on. Wire it before the first
 * `page.goto`. The HMR websocket is not an HTTP request, so it never shows
 * up. A main-frame navigation forgets the previous document's requests:
 * Chromium cancels them without always firing `requestfailed`, and a reload
 * (vite's full reload included) would otherwise report them forever.
 *
 * @example
 * const requests = trackPageRequests(page);
 * await page.goto(url);
 * requests.unanswered(); // [{ url, startedAt }] for each module in flight
 */
export function trackPageRequests(page: Page): PageRequests {
  const pending = new Map<Request, UnansweredRequest>();
  const failed: FailedRequest[] = [];
  page.on("request", (request) =>
    pending.set(request, { url: request.url(), startedAt: Date.now() }),
  );
  page.on("requestfinished", (request) => pending.delete(request));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    const issued = pending.get(request);
    if (issued) failed.push({ ...issued, failure });
    pending.delete(request);
  });
  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return;
    pending.clear();
    failed.length = 0;
  });
  return { unanswered: () => [...pending.values()], failed: () => [...failed] };
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
 * and formats the result with the failed requests, the page's errors and the
 * server's log — see `formatBlankPageReport`.
 *
 * @example
 * const report = await describeBlankPage(requests, errors, server.log());
 */
export async function describeBlankPage(
  requests: PageRequests,
  pageErrors: readonly string[],
  serverLog: readonly string[],
): Promise<string> {
  const takenAt = Date.now();
  const unanswered = requests.unanswered();
  const probes = await Promise.all(
    unanswered.map((request) => probeRequest(request.url, PROBE_TIMEOUT_MS)),
  );
  return formatBlankPageReport({
    unanswered,
    probes,
    failed: requests.failed(),
    takenAt,
    pageErrors,
    serverLog,
  });
}
