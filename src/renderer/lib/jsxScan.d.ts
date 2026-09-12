/**
 * Character-level scanning helpers for the strict JSX the generator
 * emits. Shared by the named-slot and binding pre-passes in parseCode.
 * None of this is a JSX parser: it only balances braces, parens, and
 * string literals well enough to find where an expression or an opening
 * tag ends.
 */
/**
 * From `openIdx` (pointing at `{`), the index of the matching `}`,
 * balancing nested braces and ignoring braces inside string literals.
 * -1 when unbalanced.
 */
export declare const findMatchingBrace: (s: string, openIdx: number) => number;
/**
 * From `tagOpen` (at `<`), the index of the `>` that closes the OPENING
 * tag, skipping braces/strings so JSX-valued props don't confuse it.
 * -1 when not found.
 */
export declare const findOpeningTagClose: (s: string, tagOpen: number) => number;
/**
 * Split `s` on top-level commas — commas not inside braces, brackets,
 * parens, or string literals. Empty trailing segments are dropped.
 */
export declare const splitTopLevel: (s: string) => string[];
