import { readFileSync } from "node:fs";

const STYLESHEET = readFileSync(
  new URL("../../src/web/src/styles.css", import.meta.url),
  "utf8",
);

/**
 * The declarations of the first `styles.css` rule written `<selector> {`.
 *
 * @example
 * ruleBody(".dark"); // → ".dark {\n  --background: #0a0a0a; …"
 */
export function ruleBody(selector: string): string {
  const start = STYLESHEET.indexOf(`${selector} {`);
  if (start < 0) {
    throw new Error(`Expected a "${selector} {" rule in styles.css`);
  }
  return STYLESHEET.slice(start, STYLESHEET.indexOf("}", start));
}

/**
 * The `#rrggbb` value a rule body declares for one custom property.
 *
 * @example
 * tokenIn(ruleBody(".dark"), "--background"); // → "#0a0a0a"
 */
export function tokenIn(body: string, name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(body);
  if (!match?.[1]) {
    throw new Error(`Expected "${name}: #rrggbb" in the rule, got none`);
  }
  return match[1];
}
