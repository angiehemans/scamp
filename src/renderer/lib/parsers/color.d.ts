/**
 * Split a CSS color into a base hex (without alpha) and an alpha 0..1.
 *
 * - `#rrggbb` / `#rgb`         → base = `#rrggbb`, alpha = 1, decomposable
 * - `rgb(r, g, b)` / `rgba(r, g, b, a)` → base = `#rrggbb`, alpha = a ?? 1
 * - anything else (`var()`, `currentColor`, named, …) → base = original
 *   value, alpha = 1, `decomposable: false` — the caller should disable
 *   the opacity slider so the user doesn't lose the token / keyword.
 *
 * Always returns alpha clamped to [0, 1].
 */
export type SplitShadowColor = {
    base: string;
    alpha: number;
    decomposable: boolean;
    /**
     * True when the source value carried an explicit alpha component
     * (an rgba(...) syntax). Lets callers tell "user hasn't set an
     * opacity yet" apart from "user set opacity to 100".
     */
    hasExplicitAlpha: boolean;
};
export declare const splitShadowColor: (value: string) => SplitShadowColor;
/**
 * Inverse of `splitShadowColor`. Given a base color and an alpha 0..1,
 * produce the canonical CSS string the panel writes back to
 * `BoxShadowDef.color`.
 *
 * For decomposable bases (hex / rgb), always emits `rgba(...)` — the
 * Shadows section deliberately normalises here so the file never holds
 * a hex+separate-opacity in two places. Non-decomposable bases (`var()`,
 * `currentColor`, named) are passed through unchanged: an alpha
 * component can't be safely tacked on without losing the reference.
 */
export declare const combineShadowColor: (base: string, alpha: number) => string;
