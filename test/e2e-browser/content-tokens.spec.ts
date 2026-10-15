import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { rewriteUntilServerLogs } from "../lib/write-until-logged.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import type { BiacDev } from "./dev-server.fixture.js";
import { expectProbes, TOKENS } from "./theme-probes.js";
import type { ChromeProbe } from "./theme-probes.js";

function callout(page: Page, title: string) {
  return page.getByRole("note").filter({ hasText: title });
}

function kpi(page: Page) {
  return page
    .locator("div")
    .filter({ hasText: /^Quarter revenue/ })
    .first();
}

/** The content widgets `/weekly-review` ships, one probe per painted colour. */
const REVIEW_PROBES: ChromeProbe[] = [
  {
    name: "info callout surface",
    locate: (p) => callout(p, "Reading guide"),
    property: "backgroundColor",
    token: "--info-surface",
  },
  {
    name: "info callout border",
    locate: (p) => callout(p, "Reading guide"),
    property: "borderTopColor",
    token: "--info-border",
  },
  {
    name: "info callout text",
    locate: (p) => callout(p, "Reading guide"),
    property: "color",
    token: "--info-foreground",
  },
  {
    name: "warning callout surface",
    locate: (p) => callout(p, "Concentration risk"),
    property: "backgroundColor",
    token: "--warning-surface",
  },
  {
    name: "success callout text",
    locate: (p) => callout(p, "Clean lift"),
    property: "color",
    token: "--success-foreground",
  },
  {
    name: "big value title",
    locate: (p) => kpi(p).getByText("Quarter revenue"),
    property: "color",
    token: "--muted-foreground-faded",
  },
  {
    name: "positive delta",
    locate: (p) => kpi(p).locator('[data-status="positive"]'),
    property: "color",
    token: "--positive",
  },
  {
    name: "note",
    locate: (p) => p.getByText(/^Figures cover the 13-week/),
    property: "color",
    token: "--muted-foreground-faded",
  },
  {
    name: "details trigger",
    locate: (p) => p.getByRole("button", { name: "Metric definitions" }),
    property: "color",
    token: "--label",
  },
  {
    name: "tab list rule",
    locate: (p) => p.getByRole("tablist").first(),
    property: "borderBottomColor",
    token: "--border",
  },
  {
    name: "tab indicator",
    locate: (p) => p.getByRole("tablist").first().locator("> span"),
    property: "borderBottomColor",
    token: "--foreground",
  },
  {
    name: "table header rule",
    locate: (p) => p.locator("th").first(),
    property: "borderBottomColor",
    token: "--border-strong",
  },
  {
    name: "table row rule",
    locate: (p) => p.locator("td").first(),
    property: "borderBottomColor",
    token: "--border",
  },
  {
    name: "table pager",
    locate: (p) =>
      p
        .getByText(/^Page 1 of/)
        .first()
        .locator(".."),
    property: "color",
    token: "--muted-foreground-faded",
  },
  {
    name: "sparkline stroke",
    locate: (p) => p.locator('svg[aria-label="weekly_revenue"]').first(),
    property: "color",
    token: "--sparkline",
  },
  {
    name: "prose link",
    locate: (p) =>
      p.getByRole("link", { name: "orders overview", exact: true }).first(),
    property: "color",
    token: "--link",
  },
];

/**
 * A page whose query fails, so the fence and every data widget show their
 * error state (5 alerts), beside an error callout and two negative tones.
 */
const TONES_PAGE = `---
title: Tones
---

# Tones

\`\`\`sql broken
select * from nowhere
\`\`\`

\`\`\`sql fall
select -0.05 as change, -12 as amount
\`\`\`

<Callout type="error" title="Broken feed">The feed stopped.</Callout>

<Table data="broken" />

<BarChart data="broken" x="a" y="b" />

Inline <Value data="broken" column="x" /> and a drop of <Delta data="fall" column="change" fmt="pct1" />, signed <Value data="fall" column="amount" redNegatives />.

<Tab title="Orphan">No parent.</Tab>
`;

const TONES_PROBES: ChromeProbe[] = [
  {
    name: "error callout surface",
    locate: (p) => callout(p, "Broken feed"),
    property: "backgroundColor",
    token: "--destructive-surface",
  },
  {
    name: "error callout border",
    locate: (p) => callout(p, "Broken feed"),
    property: "borderTopColor",
    token: "--destructive-border",
  },
  ...[0, 1, 2, 3, 4].flatMap((index): ChromeProbe[] => [
    {
      name: `error state ${index} surface`,
      locate: (p) => p.getByRole("alert").nth(index),
      property: "backgroundColor",
      token: "--destructive-surface",
    },
    {
      name: `error state ${index} text`,
      locate: (p) => p.getByRole("alert").nth(index),
      property: "color",
      token: "--destructive-foreground",
    },
  ]),
  {
    name: "negative delta",
    locate: (p) => p.locator('[data-status="negative"]'),
    property: "color",
    token: "--negative",
  },
  {
    name: "red negative value",
    locate: (p) => p.getByText("-12.0", { exact: true }),
    property: "color",
    token: "--negative",
  },
];

/** A colour per token no Tailwind tone paints, to prove a probe reads its token. */
const SENTINELS: Record<string, string> = {
  "--info-surface": "#ff0000",
  "--info-border": "#00ff00",
  "--info-foreground": "#0000ff",
  "--warning-surface": "#ff00ff",
  "--success-foreground": "#00ffff",
  "--muted-foreground-faded": "#ffff00",
  "--positive": "#ff8000",
  "--label": "#8000ff",
  "--border": "#0080ff",
  "--foreground": "#80ff00",
  "--border-strong": "#ff0080",
  "--sparkline": "#00ff80",
  "--link": "#800000",
  "--destructive-surface": "#008000",
  "--destructive-border": "#000080",
  "--destructive-foreground": "#808000",
  "--negative": "#008080",
};

async function overrideTokens(page: Page): Promise<void> {
  await page.evaluate((sentinels) => {
    for (const [token, value] of Object.entries(sentinels)) {
      document.documentElement.style.setProperty(token, value);
    }
  }, SENTINELS);
}

async function openWeeklyReview(page: Page, url: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${url}weekly-review`);
  await expect(kpi(page).locator('[data-status="positive"]')).toBeVisible();
}

// An added page changes the manifest, a full reload the server only logs to
// a connected client; a `goto` while it runs is aborted, so the reloaded
// sidebar listing the page comes first.
async function openTonesPage(page: Page, biacDev: BiacDev): Promise<void> {
  await page.goto(biacDev.url);
  await rewriteUntilServerLogs({
    rewrite: () =>
      writeFileSync(join(biacDev.projectDir, "pages/tones.md"), TONES_PAGE),
    log: biacDev.log,
    loggedPath: "pages/tones.md",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  await expect(
    page
      .getByRole("navigation", { name: "Site navigation" })
      .getByRole("link", { name: "Tones" }),
  ).toBeVisible();
  await page.goto(`${biacDev.url}tones`);
  await expect(page.getByRole("alert")).toHaveCount(5);
  await expect(page.locator('[data-status="negative"]')).toBeVisible();
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });
    const tokens = TOKENS[colorScheme];

    test("the content widgets paint from the tokens", async ({
      page,
      biacDev,
    }) => {
      const errors = collectConsoleErrors(page);
      await openWeeklyReview(page, biacDev.url);
      await expectProbes(page, REVIEW_PROBES, tokens);
      expect(errors).toEqual([]);
    });

    test("the content widgets follow a changed token", async ({
      page,
      biacDev,
    }) => {
      await openWeeklyReview(page, biacDev.url);
      await overrideTokens(page);
      await expectProbes(page, REVIEW_PROBES, { ...tokens, ...SENTINELS });
    });

    test("the error and negative tones paint from the tokens", async ({
      page,
      biacDev,
    }) => {
      await openTonesPage(page, biacDev);
      await expectProbes(page, TONES_PROBES, tokens);
      await overrideTokens(page);
      await expectProbes(page, TONES_PROBES, { ...tokens, ...SENTINELS });
    });
  });
}
