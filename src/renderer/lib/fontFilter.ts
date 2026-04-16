/**
 * Typeahead filter for the font picker. Ranks prefix matches above
 * substring matches so typing `"Hel"` surfaces `Helvetica` before
 * something like `Comic Sans MS` that happens to contain "hel". Stable
 * within each rank so the underlying alphabetical order is preserved.
 */

export const filterFonts = (
  fonts: ReadonlyArray<string>,
  query: string
): ReadonlyArray<string> => {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return fonts;

  const prefix: string[] = [];
  const substring: string[] = [];
  for (const family of fonts) {
    const lower = family.toLowerCase();
    if (lower.startsWith(q)) {
      prefix.push(family);
    } else if (lower.includes(q)) {
      substring.push(family);
    }
  }
  return [...prefix, ...substring];
};
