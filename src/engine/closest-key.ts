// Beyond two edits a suggestion is more often wrong than helpful: `pagewidth`
// is not a misspelling of any accepted key.
const MAX_SUGGESTION_DISTANCE = 2;

/**
 * Picks the accepted key an unknown one most likely meant to be, for a
 * "did you mean" hint. A case-only difference wins outright; otherwise the
 * key with the fewest single-character edits, at most two, earliest in
 * `accepted` on a tie. Returns undefined when nothing is close.
 *
 * @example
 * closestKey("titel", ["title", "theme"]); // "title"
 */
export function closestKey(
  candidate: string,
  accepted: readonly string[],
): string | undefined {
  const lower = candidate.toLowerCase();
  const sameIgnoringCase = accepted.find((key) => key.toLowerCase() === lower);
  if (sameIgnoringCase !== undefined) return sameIgnoringCase;
  let best: string | undefined;
  let bestDistance = MAX_SUGGESTION_DISTANCE + 1;
  for (const key of accepted) {
    const distance = editDistance(candidate, key);
    if (distance >= bestDistance) continue;
    best = key;
    bestDistance = distance;
  }
  return best;
}

/** Levenshtein distance, computed one row of the edit table at a time. */
function editDistance(from: string, to: string): number {
  const firstRow = Array.from({ length: to.length + 1 }, (_, column) => column);
  const lastRow = [...from].reduce(
    (previous, fromChar, row) => nextRow(previous, fromChar, row + 1, to),
    firstRow,
  );
  // Every row holds to.length + 1 cells, so `at(-1)` is always defined; the
  // fallback is the distance from an empty string.
  return lastRow.at(-1) ?? to.length;
}

function nextRow(
  previous: readonly number[],
  fromChar: string,
  rowStart: number,
  to: string,
): number[] {
  const current = [rowStart];
  let diagonal = rowStart - 1;
  let left = rowStart;
  for (const [column, above] of previous.slice(1).entries()) {
    const substitution = fromChar === to[column] ? 0 : 1;
    left = Math.min(above + 1, left + 1, diagonal + substitution);
    current.push(left);
    diagonal = above;
  }
  return current;
}
