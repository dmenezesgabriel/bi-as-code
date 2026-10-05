import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { After, BeforeAll, Given, Then, When } from "@cucumber/cucumber";
// .ts specifiers, not .js — Node's type stripping resolves the real files.
import {
  buildCli,
  startDevServer,
  type DevServer,
} from "../../../lib/dev-server.ts";
import { eventually, getOk } from "../../../lib/http.ts";
import { copyShippedProject } from "../../../lib/shipped-project.ts";

// Same @id/ rule as dev-server.steps.ts — join onto a base ending in "/".
const MANIFEST_URL = "@id/virtual:biac-pages";
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

Given("the shipped example project", () => {
  projectRoot = mkdtempSync(join(tmpdir(), "biac-chrome-"));
  copyShippedProject(projectRoot);
});

When("biac dev serves it", async () => {
  assert.ok(projectRoot, "project must exist before starting the server");
  server = await startDevServer(projectRoot);
});

Then(
  "the manifest module serves the nav tree with titles, positions and the Nested group",
  async () => {
    const code = await getOk(`${server!.url}${MANIFEST_URL}`);
    // Entries carry the fm nav fields the tree was built from.
    assert.match(code, /route: "\/nested\/page".*sidebarPosition: 1/);
    assert.match(code, /route: "\/nested\/allocation".*sidebarPosition: 2/);
    // Region detail precedes Allocation despite alphabetical order —
    // sidebar_position wins. Allocation has no fm title, so its nav
    // label is the deslugified file name.
    assert.match(
      code,
      /"rootPages":\[\{"name":"Orders overview","href":"\/"\},\{"name":"Weekly review","href":"\/weekly-review"\}\]/,
    );
    assert.match(
      code,
      /"directories":\[\{"id":"nested","name":"Nested","pages":\[\{"name":"Region detail","href":"\/nested\/page"\},\{"name":"Allocation","href":"\/nested\/allocation"\}\]\}\]/,
    );
  },
);

Then("the config module serves the configured title", async () => {
  const code = await getOk(`${server!.url}${CONFIG_URL}`);
  assert.match(code, /"title":"biac"/);
  assert.match(code, /"sidebar":true/);
});

Then(
  "the HTML shell wires the pre-paint theme script and the favicon",
  async () => {
    const html = await getOk(server!.url);
    assert.match(html, /__BIAC_THEME__="system"/);
    assert.match(html, /href="\/favicon\.svg"/);
  },
);

Then("the favicon serves", async () => {
  const res = await fetch(`${server!.url}favicon.svg`);
  assert.equal(res.status, 200);
});

When('I rename the site to "ACME" in biac.config.ts', () => {
  assert.ok(projectRoot, "project must exist");
  writeFileSync(
    join(projectRoot, "biac.config.ts"),
    'export default { title: "ACME" };\n',
  );
});

Then("the config module serves the new title", async () => {
  await eventually(async () =>
    (await getOk(`${server!.url}${CONFIG_URL}`)).includes('"ACME"'),
  );
});

Then("the server stops on SIGINT", async () => {
  assert.ok(server, "server must be running");
  assert.equal(await server.stop(), 0);
});
