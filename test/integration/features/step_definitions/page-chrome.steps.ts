import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import type { SearchDocumentSets } from "../../../../src/engine/types.ts";

// Same @id/ rule as dev-server.steps.ts — join onto a base ending in "/".
const MANIFEST_URL = "@id/virtual:biac-pages";
const CONFIG_URL = "@id/virtual:biac-config";
const SEARCH_URL = "@id/virtual:biac-search";
const ALLOCATION_PAGE = "pages/nested/allocation.md";

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
  "the manifest module serves the nav tree with titles, positions, icons and the titled nested group",
  async () => {
    const code = await getOk(`${server!.url}${MANIFEST_URL}`);
    // Entries carry the fm nav fields the tree was built from.
    assert.match(code, /route: "\/nested\/page".*sidebarPosition: 1/);
    assert.match(code, /route: "\/nested\/allocation".*sidebarPosition: 2/);
    // Region detail precedes Allocation despite alphabetical order —
    // sidebar_position wins. Allocation has no fm title, so its nav
    // label is the deslugified file name, and it names no icon.
    assert.match(
      code,
      /"rootPages":\[\{"name":"Orders overview","href":"\/","icon":"house"\},\{"name":"Cross-filter at scale","href":"\/crossfilter-scale","icon":"filter"\},\{"name":"Deploy on AWS","href":"\/deploy-on-aws","icon":"cloud"\},\{"name":"Orders dashboard","href":"\/orders-dashboard","icon":"layout-dashboard"\},\{"name":"Regional orders","href":"\/regional-orders","icon":"map"\},\{"name":"Weekly orders","href":"\/weekly-orders","icon":"chart-column"\},\{"name":"Weekly revenue \(embed\)","href":"\/embed-weekly-revenue","icon":"chart-line"\},\{"name":"Weekly review","href":"\/weekly-review","icon":"calendar"\}\]/,
    );
    assert.match(
      code,
      /"directories":\[\{"id":"nested","name":"Breakdowns","pages":\[\{"name":"Region detail","href":"\/nested\/page","icon":"map-pin"\},\{"name":"Allocation","href":"\/nested\/allocation"\}\]\}\]/,
    );
  },
);

Then(
  "the config module serves the configured title and page layout",
  async () => {
    const code = await getOk(`${server!.url}${CONFIG_URL}`);
    assert.match(code, /"title":"biac"/);
    assert.match(code, /"sidebar":true/);
    assert.match(
      code,
      /"layout":\{"page_width":"article","cards":false,"table_of_contents":true,"table_of_contents_label":"On this page"\}/,
    );
  },
);

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

When('I title the nested folder "Planning" in biac.config.ts', () => {
  assert.ok(projectRoot, "project must exist");
  writeFileSync(
    join(projectRoot, "biac.config.ts"),
    'export default { directories: { "pages/nested": { title: "Planning" } } };\n',
  );
});

Then('the manifest module names the nested folder "Planning"', async () => {
  await eventually(async () =>
    (await getOk(`${server!.url}${MANIFEST_URL}`)).includes(
      '"id":"nested","name":"Planning"',
    ),
  );
});

When("I brand the primary colour in biac.config.ts", () => {
  assert.ok(projectRoot, "project must exist");
  writeFileSync(
    join(projectRoot, "biac.config.ts"),
    'export default { brand: { colors: { primary: { light: "#154886", dark: "#60a5fa" } } } };\n',
  );
});

Then("the HTML shell sets the brand colours in the body", async () => {
  await eventually(async () =>
    /<body>\s*<style>:root,\n\.light \{\n {2}--primary: #154886;/.test(
      await getOk(server!.url),
    ),
  );
});

When("I set a brand palette in biac.config.ts", () => {
  assert.ok(projectRoot, "project must exist");
  writeFileSync(
    join(projectRoot, "biac.config.ts"),
    'export default { brand: { palette: { light: ["#1e40af"], dark: ["#60a5fa"] } } };\n',
  );
});

Then("the HTML shell sets the first series colour in the body", async () => {
  await eventually(async () =>
    /<body>\s*<style>:root,\n\.light \{\n {2}--chart-1: #1e40af;/.test(
      await getOk(server!.url),
    ),
  );
});

When("I set a brand scale in biac.config.ts", () => {
  assert.ok(projectRoot, "project must exist");
  writeFileSync(
    join(projectRoot, "biac.config.ts"),
    'export default { brand: { scale: { light: ["#1e40af"], dark: ["#0a0a0a", "#60a5fa"] } } };\n',
  );
});

Then("the HTML shell sets the heatmap ramp in the body", async () => {
  await eventually(async () =>
    /<body>\s*<style>[^<]*\.dark \{\n {2}--chart-scale: #0a0a0a, #60a5fa;/.test(
      await getOk(server!.url),
    ),
  );
});

When(
  "I set a brand background under its contrast floor in biac.config.ts",
  () => {
    assert.ok(projectRoot, "project must exist");
    writeFileSync(
      join(projectRoot, "biac.config.ts"),
      'export default {\n  brand: { colors: { background: { light: "#fdf6e3", dark: "#0a0a0a" } } },\n};\n',
    );
  },
);

Then(
  "the HTML shell fails naming the colour, its floor and its line",
  async () => {
    await eventually(async () => {
      const res = await fetch(server!.url);
      const html = await res.text();
      return (
        res.status === 500 &&
        html.includes(
          "Invalid biac.config.ts:2:36 — brand.colors.background.light: #fdf6e3 against --chart-4 #cc79a7 measures 2.83:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11)",
        )
      );
    });
  },
);

Then("the server stops on SIGINT", async () => {
  assert.ok(server, "server must be running");
  assert.equal(await server.stop(), 0);
});

Then(
  "the search module serves Allocation with its body word {string}",
  async (word: string) => {
    const code = await getOk(`${server!.url}${SEARCH_URL}`);
    assert.match(
      code,
      new RegExp(
        `\\{"id":"/nested/allocation","title":"Allocation","text":"[^"]*${word}`,
      ),
    );
  },
);

/** The served search documents, one set per declared language. */
async function servedSearchSets(): Promise<SearchDocumentSets> {
  const code = await getOk(`${server!.url}${SEARCH_URL}`);
  const json = /Object\.assign\(store, (.*)\);/.exec(code)?.[1];
  assert.ok(json, `expected "Object.assign(store, {...});" in ${code}`);
  return JSON.parse(json) as SearchDocumentSets;
}

Then(
  "the {string} search documents name Weekly review with {string}",
  async (language: string, word: string) => {
    const sets = await servedSearchSets();
    const review = sets.byLanguage[language]?.find(
      (document) => document.title === "Weekly review",
    );
    assert.match(review?.text ?? "", new RegExp(word));
  },
);

Then(
  "the search module serves Allocation with the keyword {string}",
  async (keyword: string) => {
    await eventually(async () => {
      const sets = await servedSearchSets();
      const allocation = sets.byLanguage[sets.languages[0] ?? ""]?.find(
        (document) => document.id === "/nested/allocation",
      );
      return allocation?.keywords === keyword;
    });
  },
);

When("I set {string} in the Allocation page's front-matter", (line: string) => {
  const file = join(projectRoot!, ALLOCATION_PAGE);
  const source = readFileSync(file, "utf8");
  writeFileSync(file, source.replace("---\n", `---\n${line}\n`));
});

Then(
  "the Allocation page module fails naming {string}",
  async (message: string) => {
    const url = `${server!.url}@fs${projectRoot}/${ALLOCATION_PAGE}?import`;
    await eventually(async () => (await getOk(url)).includes(message));
  },
);
