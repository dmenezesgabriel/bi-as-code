/**
 * Retries `check` until it passes or the deadline lapses — file-watch
 * events and server startup are timing-sensitive, and sleeping a fixed
 * delay is how flaky tests are born.
 *
 * @example
 * await eventually(async () => (await fetch(url)).status === 200);
 */
export async function eventually(
  check: () => Promise<boolean>,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`timed out after ${timeoutMs}ms waiting for condition`);
}

/** GETs `url` and returns its body text; a non-200 response fails loudly. */
export async function getOk(url: string): Promise<string> {
  const res = await fetch(url);
  if (res.status !== 200) {
    throw new Error(`GET ${url} → ${res.status}, expected 200`);
  }
  return res.text();
}
