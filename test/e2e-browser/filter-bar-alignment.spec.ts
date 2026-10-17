import type { Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expect,
  test,
  urlParam,
} from "./dev-server.fixture.js";
import {
  flexLines,
  measureFields,
  type FieldGeometry,
  type FilterField,
} from "./field-geometry.js";

/**
 * A `<FilterBar>` reads as two lines per wrapped row: every label on one,
 * every control box on the other, one height throughout. 36 px is evidence's
 * `h-9` and the toggle's existing box.
 */
const CONTROL_HEIGHT = 36;

function weeklyReviewFields(page: Page): FilterField[] {
  const bar = page.locator("[data-filter-bar]");
  const named = (role: "combobox" | "group" | "textbox", name: string) =>
    bar.getByRole(role, { name, exact: true });
  const toggle = bar.getByRole("switch", { name: "Large orders only" });
  const region = named("combobox", "Region");
  const ordered = bar.getByLabel("Ordered", { exact: true });
  const search = named("textbox", "Search regions");
  return [
    { name: "Region", named: region, box: region, labelRow: true },
    // The slider draws a track, not a box: only its label is on a line.
    {
      name: "Amount",
      named: named("group", "Amount"),
      box: null,
      labelRow: true,
    },
    { name: "Ordered", named: ordered, box: ordered, labelRow: true },
    { name: "Search regions", named: search, box: search, labelRow: true },
    // Its label is inline in the box, so it has no label row to line up.
    {
      name: "Large orders only",
      named: toggle,
      box: toggle.locator(".."),
      labelRow: false,
    },
  ];
}

function allocationFields(page: Page): FilterField[] {
  const bar = page.locator("[data-filter-bar]");
  const group = bar.getByRole("group", { name: "Channel", exact: true });
  const multi = bar.getByRole("combobox", { name: "Channel", exact: true });
  return [
    { name: "button group", named: group, box: group, labelRow: true },
    {
      name: "multi-select",
      named: multi,
      // The bordered input group around the chips and the search input.
      box: multi.locator("xpath=ancestor::*[@role='group'][1]"),
      labelRow: true,
    },
  ];
}

/** Asserts `read` gives every field that has a value the same one (or `expected`). */
function expectShared(
  fields: readonly FieldGeometry[],
  read: (field: FieldGeometry) => number | undefined,
  what: string,
  expected?: number,
): void {
  const measured = Object.fromEntries(
    fields.flatMap((f) => (read(f) === undefined ? [] : [[f.name, read(f)]])),
  );
  const target = expected ?? Object.values(measured)[0];
  const aligned = Object.fromEntries(
    Object.keys(measured).map((k) => [k, target]),
  );
  expect(measured, what).toEqual(aligned);
}

function expectLabelAndControlLines(measured: readonly FieldGeometry[]): void {
  for (const line of flexLines(measured)) {
    expectShared(line, (f) => f.labelTop, "label tops on one line");
    expectShared(line, (f) => f.control?.top, "control tops on one line");
    expectShared(line, (f) => f.control?.bottom, "control bottoms on one line");
  }
  expectShared(
    measured,
    (f) => f.control?.height,
    "control heights",
    CONTROL_HEIGHT,
  );
}

async function openDockedFilters(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 900));
  const filters = page.getByRole("button", { name: "Filters", exact: true });
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await filters.click();
  await expect(filters).toHaveAttribute("aria-expanded", "true");
}

/** weekly-review with every input's options and bounds loaded, so widths — and the wrap — are final. */
async function gotoWeeklyReview(page: Page, url: string): Promise<void> {
  await page.goto(`${url}weekly-review`);
  await expect(page.getByRole("combobox", { name: "Region" })).toBeEnabled();
  await expect(page.getByRole("slider", { name: "Maximum" })).toBeVisible();
}

// Expected to fail until the inputs share one control height and label row:
// Amount's label sits 8 px above Region's and Ordered's, controls are 32 px.
test.fail(
  "the resting weekly-review bar puts its labels on one line and its controls on another, one height",
  async ({ page, biacDev }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoWeeklyReview(page, biacDev.url);

    expectLabelAndControlLines(await measureFields(weeklyReviewFields(page)));
    expect(errors).toEqual([]);
  },
);

// Expected to fail until the inputs share one label row: Amount's label
// sits 8 px above Region's inside the opened panel.
test.fail(
  "the opened docked weekly-review bar keeps one label line and one control line",
  async ({ page, biacDev }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoWeeklyReview(page, biacDev.url);
    await openDockedFilters(page);

    expectLabelAndControlLines(await measureFields(weeklyReviewFields(page)));
    expect(errors).toEqual([]);
  },
);

// Expected to fail until the inputs share one control height: 32 px boxes.
test.fail(
  "at 375px the opened docked bar stacks its inputs with one label gap and one control height",
  async ({ page, biacDev }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoWeeklyReview(page, biacDev.url);
    await openDockedFilters(page);

    const measured = await measureFields(weeklyReviewFields(page));
    expect(flexLines(measured)).toHaveLength(measured.length);
    expectShared(
      measured,
      (f) =>
        f.control && f.labelTop !== undefined
          ? f.control.top - f.labelTop
          : undefined,
      "label-to-control distance",
    );
    expectShared(
      measured,
      (f) => f.control?.height,
      "control heights",
      CONTROL_HEIGHT,
    );
    expect(errors).toEqual([]);
  },
);

// Expected to fail until labels hold their line: the multi-select's label
// sits 6 px below the button group's, then 16 px above it with 3 chips.
test.fail(
  "the allocation button group and multi-select share a label line that holds as chips wrap",
  async ({ page, biacDev }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${biacDev.url}nested/allocation`);
    const multi = page.getByRole("combobox", { name: "Channel", exact: true });
    await expect(page.getByRole("button", { name: "Partner" })).toBeEnabled();

    const before = await measureFields(allocationFields(page));
    expectLabelAndControlLines(before);

    await multi.click();
    for (const channel of ["Direct", "Marketplace", "Partner"]) {
      await page.getByRole("option", { name: channel }).click();
    }
    await page.keyboard.press("Escape");
    await expect
      .poll(() => urlParam(page, "channel"))
      .toBe('["Direct","Marketplace","Partner"]');

    // Three chips wrap the multi-select to a taller box; its label stays put
    // and the button group's label stays beside it.
    const after = await measureFields(allocationFields(page));
    expectShared(
      after,
      (f) => f.labelTop,
      "label tops after picking",
      before[1]!.labelTop,
    );
    expectShared(after, (f) => f.control?.top, "control tops after picking");
    expect(errors).toEqual([]);
  },
);
