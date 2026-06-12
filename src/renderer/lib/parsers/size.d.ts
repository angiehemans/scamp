import { type HeightMode, type WidthMode } from "../element";
/** A free-form CSS length parsed into Scamp's typed width/height shape. */
export type ParsedSizeValue = {
    mode: WidthMode;
    /**
     * Best-effort integer-pixel value for canvas resize math. Only
     * meaningful when `mode === 'fixed'` — for non-fixed modes the
     * caller should leave the existing `widthValue` / `heightValue`
     * untouched.
     */
    value: number;
    /**
     * Verbatim CSS string when the input wasn't a plain px number.
     * `undefined` for plain `Npx`, mode keywords, or empty input.
     */
    custom: string | undefined;
};
/**
 * Turn a user-typed CSS length into Scamp's width/height shape.
 *
 * Behaviour:
 * - empty / whitespace → `auto` (no value change)
 * - `auto`, `fit-content`, `100%` → matching mode keyword
 * - bare number (`100`) or `Npx` → fixed, value = N, no custom
 * - anything else (`100vh`, `2em`, `calc(...)`, `var(--w)`) → fixed,
 *   value = leading number (or 0 if none), custom = verbatim string
 *
 * The `mode` field is one value of the shared WidthMode/HeightMode
 * union (they're the same union under different aliases). Callers
 * widen as needed.
 */
export declare const parseSizeValue: (raw: string) => ParsedSizeValue;
/**
 * Inverse of `parseSizeValue` — formats the typed shape back into a
 * single CSS length string. Used by the Size section's input field
 * so the user sees what the canvas / generator will emit.
 */
export declare const formatSizeValue: (mode: WidthMode | HeightMode, value: number, custom: string | undefined) => string;
