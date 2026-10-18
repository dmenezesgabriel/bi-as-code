/**
 * The error for a front-matter or `biac.config.ts` value of the wrong shape:
 * it names where the value was declared, the field, what was expected and
 * what the author wrote, so the fix needs no second look at the source.
 *
 * @example
 * throw invalidSetting("front-matter in pages/a.md", "page_width", '"article" | "full"', "wide");
 * // Invalid front-matter in pages/a.md — page_width: expected "article" | "full", got "wide"
 */
export function invalidSetting(
  location: string,
  field: string,
  expected: string,
  value: unknown,
): Error {
  return new Error(
    `Invalid ${location} — ${field}: expected ${expected}, got ${JSON.stringify(value)}`,
  );
}
