import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const STACK_DECLARATION = /(--font-(?:sans|serif|mono)):([^;]+);/g;

/**
 * The font stacks Tailwind's `@import` defines as `--font-sans`, `--font-serif`
 * and `--font-mono`, read from its published `theme.css` with whitespace
 * collapsed to the form a computed style reports. `styles.css` points the
 * brand font tokens at them (`--body-font: var(--font-stack-sans-serif)` and
 * so on); jsdom 31 substitutes `var()` and a reference to an undefined
 * property leaves the token empty, where jsdom 30 returned the literal text.
 *
 * @example
 * tailwindFontStacks().get("--font-sans"); // "ui-sans-serif, system-ui, …"
 */
export function tailwindFontStacks(): Map<string, string> {
  const theme = readFileSync(
    createRequire(import.meta.url).resolve("tailwindcss/theme.css"),
    "utf8",
  );
  const stacks = [...theme.matchAll(STACK_DECLARATION)].map(
    ([, name, value]): [string, string] => [
      name ?? "",
      (value ?? "").replace(/\s+/g, " ").trim(),
    ],
  );
  return new Map(stacks);
}

/** A `:root` rule declaring every Tailwind font stack, for a test document. */
export function tailwindFontStacksRule(): string {
  const declarations = [...tailwindFontStacks()].map(
    ([name, value]) => `${name}: ${value};`,
  );
  return `:root { ${declarations.join(" ")} }`;
}
