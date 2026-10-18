import type { Page } from "@playwright/test";

/** Counts of the cards a carded page draws, read off the live DOM. */
export function readCards(page: Page) {
  return page.evaluate(() => {
    const inCard = (selector: string) =>
      [...document.querySelectorAll(selector)].some(
        (element) => element.closest("[data-widget-card]") !== null,
      );
    return {
      cards: document.querySelectorAll("[data-widget-card]").length,
      nested: document.querySelectorAll("[data-widget-card] [data-widget-card]")
        .length,
      perTabPanel: [...document.querySelectorAll("[role=tabpanel]")].map(
        (panel) => panel.querySelectorAll("[data-widget-card]").length,
      ),
      filterBarCarded: inCard("[data-filter-bar]"),
      calloutCarded: inCard("[role=note]"),
      tint: getComputedStyle(
        document.querySelector("[data-cards]") ?? document.body,
      ).backgroundColor,
    };
  });
}

export const cardCount = async (page: Page) => (await readCards(page)).cards;

/** The rendered width of the page's `main` column, in CSS pixels. */
export const mainWidth = async (page: Page) =>
  (await page.locator("main").boundingBox())?.width ?? 0;
