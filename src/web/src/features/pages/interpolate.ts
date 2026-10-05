/**
 * The `{{…}}` template surface inside ` ```sql ` blocks. `{{params.name}}`
 * binds a URL search-param value through a `?` placeholder (injection-safe —
 * the value travels as a prepared-statement arg, never as text), and
 * `{{name}}` inlines another named block's SQL as a parenthesized subquery.
 * Filter/input/sql-file/front-matter tokens are not implemented yet; an
 * unrecognized token is an error, and a query with errors is never run.
 */

export interface InterpolationContext {
  /** URL search params — `{{params.name}}` binds `params[name]`, absent → NULL. */
  readonly params: Readonly<Record<string, unknown>>;
  /** The page's named sql blocks — `{{name}}` inlines `queries[name]`. */
  readonly queries: Readonly<Record<string, string>>;
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
      params.push(context.params[token.slice("params.".length)] ?? null);
      return "?";
    }
    const inner = context.queries[token];
    if (inner === undefined) {
      errors.push(
        `Unknown token {{${token}}} — expected {{params.<name>}} or the name of another sql block on this page`,
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
