import { type SpaceTuple } from "../spaceValue";
/**
 * Parse a CSS `border-radius` shorthand into [TL, TR, BR, BL] in px.
 *
 * CSS border-radius shorthand order:
 *   1 value  → all four corners
 *   2 values → (top-left + bottom-right) (top-right + bottom-left)
 *   3 values → top-left (top-right + bottom-left) bottom-right
 *   4 values → top-left top-right bottom-right bottom-left
 *
 * Only the radius part before any `/` is parsed — the vertical radius
 * (elliptical corners) is ignored for POC.
 */
export declare const parseBorderRadiusShorthand: (raw: string) => [number, number, number, number];
/**
 * Refusable variant of `parseBorderRadiusShorthand`. 1-4 px or var()
 * tokens are accepted; anything else (`50%`, `1.5em`, the elliptical
 * slash form) returns null so the raw declaration round-trips via
 * customProperties.
 */
export declare const parseBorderRadiusShorthandOrNull: (raw: string) => SpaceTuple | null;
