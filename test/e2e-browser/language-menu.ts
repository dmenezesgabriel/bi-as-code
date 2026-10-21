import type { Page } from "@playwright/test";

/**
 * Picks a language from the header's language menu by its native name, as a
 * reader does: open the menu, click the item.
 *
 * @example
 * await chooseLanguage(page, "Français");
 */
export async function chooseLanguage(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitemradio", { name }).click();
}

/** The language `<html lang>` declares. */
export function documentLanguage(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.lang);
}
