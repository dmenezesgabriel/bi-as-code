import type { Locator } from "@playwright/test";

/**
 * The rendered horizontal extent of an element's contents, not of its box:
 * a right-aligned label and a padded cell share a box edge yet differ in
 * where their text ends, and this is where the text ends.
 *
 * @example
 * const { right } = await textBounds(page.locator("td").first());
 */
export function textBounds(
  element: Locator,
): Promise<{ left: number; right: number }> {
  return element.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const { left, right } = range.getBoundingClientRect();
    return { left, right };
  });
}
