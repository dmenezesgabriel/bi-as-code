/**
 * Quotes a name as a SQL identifier — embedded `"` doubled — so an
 * author-given table or column name can never break out of its slot.
 *
 * @example
 * identifier('odd"name'); // → '"odd""name"'
 */
export function identifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}
