/**
 * Build a normalised representation of a keyframes body for
 * structural equivalence comparison. Each keyframe stop becomes
 * `<sortedSelector>{<sortedDeclList>}`; whitespace, declaration
 * order, and `from`/`to` ↔ `0%`/`100%` differences are erased.
 *
 * Returns null for input postcss can't parse.
 */
declare const normaliseKeyframesBody: (body: string) => string | null;
/**
 * True when `body` is structurally equivalent to the canonical body
 * of the named preset. Whitespace, declaration order, and
 * `from`/`to` ↔ `0%`/`100%` are normalised before comparison so a
 * naturally-typed agent variant doesn't get flagged as custom.
 *
 * Returns false when the name isn't a known preset OR the body fails
 * to parse OR the bodies don't match.
 */
export declare const matchesPreset: (name: string, body: string) => boolean;
export { normaliseKeyframesBody };
