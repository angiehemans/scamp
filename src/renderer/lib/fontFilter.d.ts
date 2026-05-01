/**
 * Typeahead filter for the font picker. Ranks prefix matches above
 * substring matches so typing `"Hel"` surfaces `Helvetica` before
 * something like `Comic Sans MS` that happens to contain "hel". Stable
 * within each rank so the underlying alphabetical order is preserved.
 */
export declare const filterFonts: (fonts: ReadonlyArray<string>, query: string) => ReadonlyArray<string>;
