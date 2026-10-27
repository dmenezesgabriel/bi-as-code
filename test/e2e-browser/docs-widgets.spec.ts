import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expect,
  resultTables,
  test,
} from "./dev-server.fixture.js";
import { expectProbes, TOKENS } from "./theme-probes.js";

test.use({ biacProject: "docs", viewport: { width: 375, height: 812 } });

/**
 * One widget reference page: the tags its `mdx echo` fences use, and the
 * live element each one draws, so every example's output is counted
 * against the markup that should have drawn it.
 */
interface WidgetPage {
  readonly route: string;
  readonly file: string;
  readonly drawn: readonly {
    readonly tag: RegExp;
    readonly live: (page: Page) => Locator;
  }[];
}

const sparklines = (page: Page) => page.locator("main svg[role=img]");

const WIDGET_PAGES: readonly WidgetPage[] = [
  {
    route: "/components/table",
    file: "pages/components/table.md",
    drawn: [{ tag: /<Table\b/g, live: resultTables }],
  },
  {
    route: "/components/big-value",
    file: "pages/components/big-value.md",
    drawn: [
      // The value line's `text-xl` span is the one mark every BigValue draws.
      {
        tag: /<BigValue\b/g,
        live: (page) => page.locator("main span.text-xl"),
      },
    ],
  },
  {
    route: "/components/value",
    file: "pages/components/value.md",
    drawn: [
      { tag: /<Delta\b/g, live: (page) => page.locator("main [data-status]") },
      { tag: /<Sparkline\b/g, live: sparklines },
    ],
  },
];

/** How many times `tag` appears inside the page file's `mdx echo` fences. */
function echoedTagCount(source: string, tag: RegExp): number {
  const fences = source.matchAll(/^```mdx echo\n([\s\S]*?)^```$/gm);
  return [...fences].reduce(
    (sum, [, body]) => sum + (body!.match(tag)?.length ?? 0),
    0,
  );
}

function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode at 375 px`, () => {
    test.use({ colorScheme });

    for (const { route, file, drawn } of WIDGET_PAGES) {
      test(`${route} draws every echoed example without an alert or a sideways scroll`, async ({
        page,
        biacDev,
      }) => {
        const errors = collectConsoleErrors(page);
        const source = readFileSync(join(biacDev.projectDir, file), "utf8");

        await page.goto(`${biacDev.url}${route}`);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator("main [role=status]")).toHaveCount(0);

        for (const { tag, live } of drawn) {
          const echoed = echoedTagCount(source, tag);
          expect(echoed, `${tag} in ${file}`).toBeGreaterThan(0);
          await expect(live(page)).toHaveCount(echoed);
        }
        await expect(page.locator("main [role=alert]")).toHaveCount(0);
        expect(await pageOverflow(page)).toBe(0);
        await expectProbes(
          page,
          [
            {
              name: "body text",
              locate: (p) => p.locator("main > p").first(),
              property: "color",
              token: "--foreground",
            },
          ],
          TOKENS[colorScheme],
        );
        expect(errors).toEqual([]);
      });
    }

    test("a sparkline paints in the theme's sparkline colour", async ({
      page,
      biacDev,
    }) => {
      const errors = collectConsoleErrors(page);
      await page.goto(`${biacDev.url}/components/value`);

      await expect(sparklines(page).first()).toBeVisible();
      await expectProbes(
        page,
        [
          {
            name: "sparkline stroke",
            locate: (p) => sparklines(p).first(),
            property: "color",
            token: "--sparkline",
          },
        ],
        TOKENS[colorScheme],
      );
      expect(errors).toEqual([]);
    });
  });
}
