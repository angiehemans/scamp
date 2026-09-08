import type { TransformDef } from "../element";
/**
 * Parse one function call into a `TransformDef`.
 *
 * Accepts the two-axis forms and their axis-specific spellings
 * (`translateX`, `scaleY`, `skewX`, …), each normalised to the two-axis
 * def. Refuses — returns null — for anything else: `matrix(...)`,
 * `translate3d(...)`, `rotate3d(...)`, `perspective(...)`, an angle in
 * `turn`/`rad`, a bad argument count. The caller then keeps the whole
 * declaration verbatim in `customProperties`.
 */
export declare const parseTransformFunction: (segment: string) => TransformDef | null;
/**
 * Parse a full `transform` value. `none` / empty → `[]`. If ANY function
 * refuses, the whole value returns null so the declaration survives
 * verbatim — a partial parse would silently drop part of the author's
 * transform on the next write.
 */
export declare const parseTransformList: (raw: string) => ReadonlyArray<TransformDef> | null;
/**
 * Inverse of `parseTransformList`. Empty → empty string; the caller
 * decides between emitting nothing and `transform: none`.
 */
export declare const formatTransformList: (transforms: ReadonlyArray<TransformDef>) => string;
