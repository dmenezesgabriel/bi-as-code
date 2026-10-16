import {
  collectConsoleErrors,
  expect,
  test,
  urlParam,
} from "./dev-server.fixture.js";

/**
 * The `<FilterBar>` container on weekly-review, driven as a reader does:
 * scrolling docks it, `Filters` opens its inputs, and the inputs keep
 * writing their URL params from the docked card.
 */

test("the FilterBar docks at 64px as one Filters row, holds the page still and its opened inputs keep writing", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  // The bar is the sticky `div` holding the inputs — the TOC is sticky too
  // but is an `aside`, so the element scoping pins the bar alone.
  const bar = page.locator("div.sticky", { hasText: "Region" });
  const filters = page.getByRole("button", { name: "Filters", exact: true });
  const toggle = page.getByRole("switch", { name: "Large orders only" });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("Region");

  // At rest the card face is down — transparent border, no background —
  // and the bar is page content: every input shown, no trigger.
  await expect(bar).toHaveClass(/border-transparent/);
  await expect(bar).not.toHaveClass(/bg-background/);
  await expect(filters).toHaveCount(0);
  await expect(toggle).toBeVisible();
  // The bar is in flow, so what the page keeps is its height plus the
  // spacer after it. Read once Region's options have loaded: until then
  // the dropdown is narrower and the row can wrap differently.
  await expect(page.getByRole("combobox", { name: "Region" })).toBeEnabled();
  const heightHeldInFlow = () =>
    bar.evaluate((el) =>
      Math.round(
        el.getBoundingClientRect().height +
          el.nextElementSibling!.getBoundingClientRect().height,
      ),
    );
  const heightAtRest = await heightHeldInFlow();

  // Past the sentinel the bar docks 64px under the viewport top (its
  // default 4rem dock line, below the `h-12` header), gains the card face
  // and shrinks to one `Filters` row with the inputs out of reach.
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(bar).toHaveClass(/bg-background/);
  await expect(bar).toHaveClass(/shadow/);
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeHidden();
  const barBox = () =>
    bar.evaluate((el) => {
      const { top, height } = el.getBoundingClientRect();
      return { top: Math.round(top), height: Math.round(height) };
    });
  expect((await barBox()).top).toBe(64);
  expect((await barBox()).height).toBeLessThanOrEqual(56);
  // The height it gave up is held, so nothing below it moved and the
  // scroll landed where it was asked to.
  expect(await heightHeldInFlow()).toBe(heightAtRest);
  expect(await page.evaluate(() => window.scrollY)).toBe(600);

  // Opened, the inputs keep their URL writes while pinned — a raw pointer
  // click at the pinned switch's coordinates, the reader's real gesture
  // (Playwright's locator click scroll-into-views the target first, which
  // a stuck sticky bar answers with its flow position).
  await filters.click();
  await expect(filters).toHaveAttribute("aria-expanded", "true");
  const box = await toggle.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect.poll(() => urlParam(page, "large_orders")).toBe("true");
  expect((await barBox()).top).toBe(64);
  expect((await barBox()).height).toBeLessThanOrEqual(56);
  expect(await heightHeldInFlow()).toBe(heightAtRest);

  // Back at the top the card face drops as the sentinel re-enters.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(bar).toHaveClass(/border-transparent/);
  await expect(bar).not.toHaveClass(/bg-background/);
  await expect(filters).toHaveCount(0);
  await expect(toggle).toBeChecked();
  expect(errors).toEqual([]);
});

test("at 375px the opened docked FilterBar stays open through a Region pick, fits half the viewport and closes on Escape", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  // A short phone: the panel's inputs outgrow half of its 667px height,
  // so the bound and the scroll inside the card are both exercised.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${biacDev.url}weekly-review`);
  const bar = page.locator("div.sticky", { hasText: "Region" });
  const filters = page.getByRole("button", { name: "Filters", exact: true });
  const region = page.getByRole("combobox", { name: "Region" });
  await expect(region).toBeEnabled();

  await page.evaluate(() => window.scrollTo(0, 900));
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await filters.click();

  // Bar row plus the opened card: at most half of the 667px viewport,
  // with the inputs that do not fit scrolling inside the card.
  const opened = await bar.evaluate((el) => {
    const card = el.lastElementChild!;
    return {
      height:
        card.getBoundingClientRect().bottom - el.getBoundingClientRect().top,
      scrolls: card.scrollHeight > card.clientHeight,
    };
  });
  expect(opened.height).toBeLessThanOrEqual(333.5);
  expect(opened.scrolls).toBe(true);

  // The option list is portaled outside the app root: picking from it is
  // not a press on the page around the bar, so the bar stays opened.
  await region.click();
  await page.getByRole("option", { name: "West" }).click();
  await expect.poll(() => urlParam(page, "region")).toBe("West");
  await expect(filters).toHaveAttribute("aria-expanded", "true");
  await expect(region).toHaveText("West");

  await page.keyboard.press("Escape");
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await expect(filters).toBeFocused();
  await expect(region).toBeHidden();
  expect(errors).toEqual([]);
});

test("the docked Filters row counts the applied inputs and drops the count when they are cleared", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);
  const filters = page.getByRole("button", { name: "Filters", exact: true });
  const region = page.getByRole("combobox", { name: "Region" });
  const toggle = page.getByRole("switch", { name: "Large orders only" });
  await expect(region).toBeEnabled();

  // Picked at rest, where the inputs are page content and no count shows.
  await region.click();
  await page.getByRole("option", { name: "West" }).click();
  await expect.poll(() => urlParam(page, "region")).toBe("West");

  // Region still has focus, so the bar docks opened; its row already says
  // one input narrows the page — as the button's description, so its name
  // is still `Filters`.
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(filters).toHaveAttribute("aria-expanded", "true");
  await expect(filters).toHaveAccessibleDescription("1 active");
  await expect(filters).toContainText("· 1");
  await toggle.click();
  await expect(filters).toHaveAccessibleDescription("2 active");

  // Collapsed, the inputs are out of reach and the count is what is left
  // of them.
  await page.keyboard.press("Escape");
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await expect(region).toBeHidden();
  await expect(filters).toHaveAccessibleDescription("2 active");

  await filters.click();
  await toggle.click();
  await expect(filters).toHaveAccessibleDescription("1 active");

  await region.click();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect.poll(() => urlParam(page, "region")).toBeNull();
  await expect(filters).toHaveAccessibleDescription("");
  await expect(filters).toHaveText("Filters");
  expect(errors).toEqual([]);
});
