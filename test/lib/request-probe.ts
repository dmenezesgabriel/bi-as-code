/** A request the page issued that had no complete answer when it was read. */
export interface UnansweredRequest {
  readonly url: string;
  /** Epoch ms the browser issued it, so it lines up with the server log. */
  readonly startedAt: number;
}

/** What a node-side re-request of one unanswered URL got from the server. */
export interface RequestProbe {
  readonly url: string;
  readonly verdict: "answered" | "hung" | "error";
  readonly status?: number;
  readonly latencyMs: number;
  readonly error?: string;
}

export interface BlankPageEvidence {
  readonly unanswered: readonly UnansweredRequest[];
  readonly probes: readonly RequestProbe[];
  /** Console errors and uncaught exceptions — a mounted app that threw. */
  readonly pageErrors: readonly string[];
  readonly serverLog: readonly string[];
}

/**
 * Re-requests `url` over a fresh node connection and reads the whole body —
 * a server that sends headers and then stalls the body is still hung. A
 * request answered here but never in the browser never left (or never
 * reached) the browser; one that hangs here too is stuck in the server.
 *
 * @example
 * const probe = await probeRequest(`${server.url}src/main.tsx`, 10_000);
 * probe.verdict; // "answered" | "hung" | "error"
 */
export async function probeRequest(
  url: string,
  timeoutMs: number,
): Promise<RequestProbe> {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.arrayBuffer();
    const latencyMs = Math.round(performance.now() - started);
    return { url, verdict: "answered", status: response.status, latencyMs };
  } catch (error) {
    return failedProbe(url, error, Math.round(performance.now() - started));
  }
}

function failedProbe(
  url: string,
  error: unknown,
  latencyMs: number,
): RequestProbe {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return { url, verdict: "hung", latencyMs };
  }
  return { url, verdict: "error", latencyMs, error: String(error) };
}

/**
 * One sentence placing a blank page's hang: in the server when any re-request
 * hangs too, in the browser when the server answers every one.
 *
 * @example
 * classifyHang([{ url, verdict: "hung", latencyMs: 10_000 }]);
 * // "server side: stuck on 1 of 1 — <url>"
 */
export function classifyHang(probes: readonly RequestProbe[]): string {
  if (probes.length === 0) return "no request was pending — not a hang";
  const stuck = probes.filter((probe) => probe.verdict === "hung");
  if (stuck.length === 0) {
    return "browser side: the server answers every unanswered URL, so the requests never reached it or their answers never reached the page";
  }
  const urls = stuck.map((probe) => probe.url).join(", ");
  return `server side: stuck on ${stuck.length} of ${probes.length} — ${urls}`;
}

/**
 * The plain-text attachment for a test that failed on a blank page: each
 * unanswered URL with its start time and re-request result, the verdict, the
 * page's errors and the dev server's log.
 *
 * @example
 * await testInfo.attach("blank-page.txt", {
 *   body: formatBlankPageReport({ unanswered, probes, pageErrors, serverLog }),
 * });
 */
export function formatBlankPageReport(evidence: BlankPageEvidence): string {
  const rows = evidence.unanswered.map(
    (request, index) =>
      `${new Date(request.startedAt).toISOString()} ${request.url} → ${describeProbe(evidence.probes[index])}`,
  );
  return [
    `Blank page: ${rows.length} requests never answered`,
    ...rows,
    `Verdict: ${classifyHang(evidence.probes)}`,
    `Page errors (${evidence.pageErrors.length}):`,
    ...evidence.pageErrors,
    `Server log (${evidence.serverLog.length} lines):`,
    ...evidence.serverLog,
  ].join("\n");
}

function describeProbe(probe: RequestProbe | undefined): string {
  if (probe?.verdict === "answered") {
    return `${probe.status} in ${probe.latencyMs} ms`;
  }
  if (probe?.verdict === "hung") return `no answer in ${probe.latencyMs} ms`;
  return `error: ${probe?.error ?? "not re-requested"}`;
}
