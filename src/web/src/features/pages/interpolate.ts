/**
 * The `{{…}}` template surface inside ` ```sql ` blocks. `{{params.name}}`
 * binds a URL search-param value through a `?` placeholder (injection-safe —
 * the value travels as a prepared-statement arg, never as text; a list
 * value binds element by element as `[?, ?]`),
 * `{{name}}` inlines another named block's SQL as a parenthesized subquery,
 * and `{{/queries/<path>}}` inlines a query file the engine put on the page
 * under that name — its own `{{…}}` tokens resolve the same way.
 * `{{$translations.key}}` binds the key's text in the page's language
 * through a `?` placeholder too, so an apostrophe in a translation needs no
 * escaping. A bound value is never an identifier: a column chosen by
 * language is written `case {{$translations.langcode}} when 'fr' then
 * label_fr else label_en end`, not spliced into its name.
 * Filter/input/front-matter tokens are not implemented yet; an
 * unrecognized token is an error, and a query with errors is never run.
 */

import type { TranslationMap } from "./types";

export interface InterpolationContext {
  /** URL search params — `{{params.name}}` binds `params[name]`, absent → NULL, a list → one arg per element. */
  readonly params: Readonly<Record<string, unknown>>;
  /** The page's named sql blocks and query files — `{{name}}` inlines `queries[name]`. */
  readonly queries: Readonly<Record<string, string>>;
  /** The page's translations in its language — `{{$translations.a.b}}` binds `a.b`'s text; absent → none. */
  readonly translations?: TranslationMap;
}

export interface InterpolatedQuery {
  /** SQL with `{{name}}` expanded to `(sql)` and `{{params.*}}` → `?`. */
  readonly sql: string;
  /** Positional args for the `?` placeholders, in order of appearance. */
  readonly params: readonly unknown[];
  /** Non-empty → do not execute; each message names the offending token. */
  readonly errors: readonly string[];
}

const TEMPLATE_TOKEN = /\{\{([^{}]*)\}\}/g;
const TRANSLATIONS_PREFIX = "$translations.";

/**
 * Resolves one block's SQL against the page's params and named queries.
 * `active` is the cycle guard: names of queries already being expanded on
 * this recursion path — the registry seeds it with the block's own name so a
 * self-reference surfaces as an error instead of recursing forever.
 *
 * @example
 * interpolateQuery("select * from {{orders}} where r = {{params.r}}", {
 *   params: { r: "West" },
 *   queries: { orders: "select * from orders" },
 * });
 * // → { sql: "select * from (select * from orders) where r = ?", params: ["West"], errors: [] }
 */
export function interpolateQuery(
  sql: string,
  context: InterpolationContext,
  active: ReadonlySet<string> = new Set(),
): InterpolatedQuery {
  const params: unknown[] = [];
  const errors: string[] = [];
  const resolved = sql.replace(TEMPLATE_TOKEN, (_match, rawToken: string) => {
    const token = rawToken.trim();
    if (token.startsWith("params.")) {
      return bindParam(context.params[token.slice("params.".length)], params);
    }
    if (token.startsWith(TRANSLATIONS_PREFIX)) {
      return bindTranslation(token, context.translations, params, errors);
    }
    const inner = context.queries[token];
    if (inner === undefined) {
      errors.push(
        `Unknown token {{${token}}} — expected {{params.<name>}}, {{$translations.<key>}}, {{/queries/<path>}} or the name of another sql block on this page`,
      );
      return "";
    }
    if (active.has(token)) {
      errors.push(`Circular query reference: {{${token}}}`);
      return "";
    }
    const expanded = interpolateQuery(
      inner,
      context,
      new Set(active).add(token),
    );
    // Splice the subquery's own args at this position so `?` placeholders and
    // `params` stay aligned left-to-right through the whole expansion.
    params.push(...expanded.params);
    errors.push(...expanded.errors);
    return `(${expanded.sql})`;
  });
  return { sql: resolved, params, errors };
}

/**
 * Binds a param's value and returns the SQL that stands for it. The driver
 * refuses an array as one argument (`Invalid column type encountered for
 * argument 0`), so a list — what a MultiSelect writes — becomes a list
 * literal with one `?` per element: `[?, ?]`, and `[]` when nothing is
 * picked. Absent → one NULL arg.
 */
function bindParam(value: unknown, params: unknown[]): string {
  if (!Array.isArray(value)) {
    params.push(value ?? null);
    return "?";
  }
  params.push(...value);
  return `[${value.map(() => "?").join(", ")}]`;
}

/** Binds the text `token` names as a `?` arg, or records why it cannot. */
function bindTranslation(
  token: string,
  translations: TranslationMap | undefined,
  params: unknown[],
  errors: string[],
): string {
  const text = translationText(
    token.slice(TRANSLATIONS_PREFIX.length),
    translations,
  );
  if (text === undefined) {
    errors.push(
      `Undefined translation key {{${token}}} — expected a key of translations.yaml whose value is text`,
    );
    return "";
  }
  params.push(text);
  return "?";
}

/** The text at dotted `key`; undefined when absent or a map of keys. */
function translationText(
  key: string,
  translations: TranslationMap | undefined,
): string | undefined {
  let value: string | TranslationMap | undefined = translations;
  for (const part of key.split(".")) {
    // `hasOwn`: a key spelled `constructor` must not reach the prototype.
    if (typeof value !== "object" || !Object.hasOwn(value, part))
      return undefined;
    value = value[part];
  }
  return typeof value === "string" ? value : undefined;
}
