import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { After, BeforeAll, Given, Then, When } from "@cucumber/cucumber";
// .ts specifiers, not .js — Node's type stripping resolves the real files.
import {
  buildCli,
  startDevServer,
  type DevServer,
} from "../../../lib/dev-server.ts";
import { getOk, getOkResponse } from "../../../lib/http.ts";
import { copyShippedProject } from "../../../lib/shipped-project.ts";

// Joined onto `base`, which already ends in "/" — see dev-server.steps.ts.
const CONFIG_URL = "@id/virtual:biac-config";

let projectRoot: string | undefined;
let server: DevServer | undefined;

BeforeAll(() => {
  buildCli();
});

After(async () => {
  server?.kill();
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  server = undefined;
  projectRoot = undefined;
});

Given("the shipped project with its data files", () => {
  projectRoot = mkdtempSync(join(tmpdir(), "biac-data-"));
  copyShippedProject(projectRoot);
});

When("biac dev serves the project", async () => {
  assert.ok(projectRoot, "project must exist before starting the server");
  server = await startDevServer(projectRoot);
});

/** Compiled page module through vite's /@fs/ transform — the `?import`
 * marks it a JS module request, same as the manifest's lazy import(). */
function pageModule(file: string): Promise<string> {
  assert.ok(server && projectRoot, "server must be running");
  return getOk(`${server.url}@fs${projectRoot}/pages/${file}?import`);
}

Then("the orders parquet serves with parquet magic bytes", async () => {
  assert.ok(server, "server must be running");
  const res = await getOkResponse(`${server.url}data/orders.parquet`);
  assert.equal(res.headers.get("content-type"), "application/octet-stream");
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString(), "PAR1");
  assert.equal(bytes.subarray(-4).toString(), "PAR1");
});

Then("the channels csv serves with the csv content type", async () => {
  assert.ok(server, "server must be running");
  const res = await getOkResponse(`${server.url}data/channels.csv`);
  assert.equal(res.headers.get("content-type"), "text/csv");
  assert.match(await res.text(), /^channel,share,orders\nDirect,46,163/);
});

Then(
  "the index page module declares its orders table and named block",
  async () => {
    const code = await pageModule("index.md");
    assert.match(
      code,
      /export const sqlTables = \{"orders":"data\/orders\.parquet"\}/,
    );
    assert.match(code, /export const sqlBlocks = \[\{"name":"orders"/);
    assert.match(code, /\{\{params\.region\}\}/);
  },
);

Then(
  "the weekly-review module exports orders, region_share and weekly_trend",
  async () => {
    const code = await pageModule("weekly-review.md");
    for (const name of ["orders", "region_share", "weekly_trend"]) {
      assert.match(code, new RegExp(`\\{"name":"${name}"`));
    }
  },
);

Then(
  "the weekly-review module's orders, region_week and order_amounts blocks carry no region param",
  async () => {
    const code = await pageModule("weekly-review.md");
    // The block entry runs from its name to the sql string's closing brace;
    // its sql is the JSON-escaped text the browser interpolates.
    for (const name of ["orders", "region_week", "order_amounts"]) {
      const start = code.indexOf(`{"name":"${name}"`);
      assert.ok(start >= 0, `weekly-review must declare a ${name} block`);
      const end = code.indexOf('"}', start);
      assert.ok(end > start, `the ${name} block must carry a sql string`);
      assert.doesNotMatch(code.slice(start, end), /\{\{params\.region\}\}/);
    }
  },
);

Then(
  "the weekly-review module renders a Dropdown bound to the region filter",
  async () => {
    const code = await pageModule("weekly-review.md");
    // Compiled JSX keeps the author's props verbatim — the destructure and
    // the missing-reference guard prove the tag survived the transform.
    assert.match(code, /if \(!Dropdown\) _missingMdxReference/);
    assert.match(
      code,
      /_jsx\(Dropdown, \{\s*id: "region",\s*data: "orders",\s*valueColumn: "region"/,
    );
  },
);

Then(
  "the weekly-review module renders the amount, ordered, q and large_orders inputs",
  async () => {
    const code = await pageModule("weekly-review.md");
    assert.match(
      code,
      /_jsx\(Slider, \{\s*id: "amount",\s*data: "order_amounts",\s*valueColumn: "amount",\s*range: true/,
    );
    assert.match(
      code,
      /_jsx\(DateRange, \{\s*id: "ordered",\s*valueColumn: "order_date"/,
    );
    assert.match(code, /_jsx\(TextInput, \{\s*id: "q"/);
    assert.match(code, /_jsx\(Toggle, \{\s*id: "large_orders"/);
  },
);

Then(
  "the weekly-review module's order_detail block interpolates the q and large_orders params",
  async () => {
    const code = await pageModule("weekly-review.md");
    const start = code.indexOf('{"name":"order_detail"');
    assert.ok(start >= 0, "weekly-review must declare an order_detail block");
    const end = code.indexOf('"}', start);
    assert.ok(end > start, "the order_detail block must carry a sql string");
    const block = code.slice(start, end);
    assert.match(block, /\{\{params\.q\}\}/);
    assert.match(block, /\{\{params\.large_orders\}\}/);
  },
);

Then(
  "the allocation module renders a ButtonGroup bound to the channel filter",
  async () => {
    const code = await pageModule("nested/allocation.md");
    assert.match(code, /if \(!ButtonGroup\) _missingMdxReference/);
    assert.match(
      code,
      /_jsx\(ButtonGroup, \{\s*id: "channel",\s*data: "channel_mix",\s*valueColumn: "channel"/,
    );
  },
);

Then(
  "the allocation module renders a MultiSelect and a channel-filtered Table",
  async () => {
    const code = await pageModule("nested/allocation.md");
    assert.match(code, /if \(!MultiSelect\) _missingMdxReference/);
    assert.match(
      code,
      /_jsx\(MultiSelect, \{\s*id: "channel",\s*data: "channel_mix",\s*valueColumn: "channel"/,
    );
    assert.match(
      code,
      /_jsx\(Table, \{\s*data: "channel_mix",\s*filters: "channel"/,
    );
  },
);

Then("the config module declares the channels table", async () => {
  assert.ok(server, "server must be running");
  const code = await getOk(`${server.url}${CONFIG_URL}`);
  assert.match(code, /"sqlTables":\{"channels":"data\/channels\.csv"\}/);
});

Then("the allocation module has channel_mix and no sql tables", async () => {
  const code = await pageModule("nested/allocation.md");
  assert.match(code, /\{"name":"channel_mix"/);
  assert.match(code, /export const sqlTables = \{\}/);
});

Then("the data server stops on SIGINT", async () => {
  assert.ok(server, "server must be running");
  assert.equal(await server.stop(), 0);
});
