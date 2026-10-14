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
    expect(report).toMatch(
      /^Verdict: server side: stuck on 1 of \d+ — \S+run-query\.ts$/m,
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
