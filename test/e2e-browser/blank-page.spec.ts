import { expect, test } from "./dev-server.fixture.js";
import { rootIsEmpty } from "./pending-requests.js";
import { StallingProxy } from "./stalling-proxy.js";

// A module in the app's static import graph: while it is unanswered the
// graph never evaluates, so `#root` stays empty — the blank page the report
// exists to explain.
const STALLED_MODULE = "/src/features/data/run-query.ts";

test("names a module the server never answers as a server-side hang", async ({
  page,
  biacDev,
}) => {
  const proxy = new StallingProxy(biacDev.url, STALLED_MODULE);
  try {
    const proxyUrl = await proxy.listen();
    const stalled = page.waitForRequest((r) =>
      r.url().includes(STALLED_MODULE),
    );
    await page.goto(`${proxyUrl}weekly-review`, { waitUntil: "commit" });
    await stalled;

    const report = await biacDev.blankPageReport();

    const stalledUrl = new URL(STALLED_MODULE, proxyUrl).href;
    expect(await rootIsEmpty(page)).toBe(true);
    expect(report).toContain(`${stalledUrl} → no answer in`);
    // Not "1 of N": on a loaded host a sibling module can still be in
    // flight when the report is taken, and its re-request may outlast the
    // probe timeout too (measured at a 50% CPU quota: effect.js > 10 s).
    expect(report).toMatch(
      /^Verdict: server side: stuck on \d+ of \d+ — .*run-query\.ts/m,
    );
    expect(report).toMatch(/stderr .*vite:time/);
  } finally {
    await proxy.close();
  }
});

test("names a module the browser never received as a browser-side hang", async ({
  page,
  biacDev,
}) => {
  await page.route(`**${STALLED_MODULE}`, () => {});
  const stalled = page.waitForRequest((r) => r.url().includes(STALLED_MODULE));
  await page.goto(`${biacDev.url}weekly-review`, { waitUntil: "commit" });
  await stalled;

  const report = await biacDev.blankPageReport();

  const stalledUrl = new URL(STALLED_MODULE, biacDev.url).href;
  expect(await rootIsEmpty(page)).toBe(true);
  expect(report).toMatch(new RegExp(`${stalledUrl} → 200 in \\d+ ms`));
  expect(report).toMatch(/^Verdict: browser side/m);
});

test("names the page error behind a blank page with nothing pending", async ({
  page,
  biacDev,
}) => {
  await page.route(`**${STALLED_MODULE}`, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export {};",
    }),
  );
  const thrown = page.waitForEvent("pageerror");
  await page.goto(`${biacDev.url}weekly-review`);
  await thrown;

  const report = await biacDev.blankPageReport();

  expect(await rootIsEmpty(page)).toBe(true);
  // The stand-in lacks the module's exports, so the graph fails to link
  // before its body could run — the error a user's console would show too.
  expect(report).toMatch(/^Page errors \(1\):\n.*run-query\.ts/m);
});

test("forgets a request whose document was navigated away", async ({
  page,
  biacDev,
}) => {
  await page.route(`**${STALLED_MODULE}`, () => {});
  const stalled = page.waitForRequest((r) => r.url().includes(STALLED_MODULE));
  await page.goto(`${biacDev.url}weekly-review`, { waitUntil: "commit" });
  await stalled;
  await page.unrouteAll({ behavior: "ignoreErrors" });

  await page.reload();
  await expect(page.locator("#root > *")).not.toHaveCount(0);

  const report = await biacDev.blankPageReport();
  const requestRows = report.slice(0, report.indexOf("\nVerdict:"));
  expect(requestRows).not.toContain(STALLED_MODULE);
});

test("names a module request the browser gave up on", async ({
  page,
  biacDev,
}) => {
  await page.route(`**${STALLED_MODULE}`, (route) =>
    route.abort("connectionreset"),
  );
  const failed = page.waitForEvent("requestfailed");
  await page.goto(`${biacDev.url}weekly-review`, { waitUntil: "commit" });
  await failed;

  const report = await biacDev.blankPageReport();

  const failedUrl = new URL(STALLED_MODULE, biacDev.url).href;
  expect(await rootIsEmpty(page)).toBe(true);
  expect(report).toMatch(/^Failed requests \(1\):$/m);
  expect(report).toContain(`${failedUrl} — net::ERR_CONNECTION_RESET`);
});
