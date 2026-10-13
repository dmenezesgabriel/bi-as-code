import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDevServer, type DevServer } from "../lib/dev-server.js";
import { copyShippedProject } from "../lib/shipped-project.js";
import {
  installCrossfilterProbe,
  waitForSettled,
  waitForWorkerRequest,
} from "./crossfilter-probe.js";
import { expectAbandonedQueriesPostedNothingLate } from "./crossfilter-gestures.js";
import {
  collectConsoleErrors,
  collectWorkerConsoleLines,
  expect,
  test,
} from "./dev-server.fixture.js";
import { readyCharts } from "./echart-hosts.js";

// An unparameterised fence slow enough that duckdb-wasm answers several
// `POLL_PENDING_QUERY` requests before its first chunk.
const SLOW_PAGE = `---
title: Slow aggregate
---

# Slow aggregate

\`\`\`sql slow_aggregate display
select i % 1000 as k, count(*) as n from range(60000000) t(i) group by k order by k
\`\`\`
`;

let projectDir: string;
let dev: DevServer;

test.beforeAll(async () => {
  projectDir = mkdtempSync(join(tmpdir(), "biac-abandon-"));
  copyShippedProject(projectDir);
  writeFileSync(join(projectDir, "pages/slow-aggregate.md"), SLOW_PAGE);
  dev = await startDevServer(projectDir);
});

test.afterAll(async () => {
  await dev.stop();
  rmSync(projectDir, { recursive: true, force: true });
});

test("leaving a page while its plain query is still polled posts nothing late and logs nothing", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  const workerLines = collectWorkerConsoleLines(page);
  await installCrossfilterProbe(page);
  await page.goto(`${dev.url}slow-aggregate`);

  await waitForWorkerRequest(page, "POLL_PENDING_QUERY");
  await page.locator('nav a[href="/weekly-review"]').click();
  await expect(readyCharts(page)).toHaveCount(6, { timeout: 30_000 });
  await waitForSettled(page);

  await expectAbandonedQueriesPostedNothingLate(page);
  expect(workerLines).toEqual([]);
  expect(errors).toEqual([]);
});
