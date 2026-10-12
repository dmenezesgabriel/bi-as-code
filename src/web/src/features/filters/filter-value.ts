/**
 * Whether a filter value narrows or parameterizes anything: `undefined`,
 * `null`, `""`, `[]` and `false` are the states the inputs write when
 * cleared or switched off; every other value — `0` and an author's
 * `initialValue` included — is held.
 *
 * @example
 * holdsFilterValue("West"); // true
 * holdsFilterValue([]); // false
 */
export function holdsFilterValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (value === "" || value === false) return false;
  return !Array.isArray(value) || value.length > 0;
}
