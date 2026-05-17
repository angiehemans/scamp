/**
 * Per-tag overrides for properties whose browser UA-stylesheet
 * default differs from Scamp's universal `[0, 0, 0, 0]`. Without
 * these overrides, a user-authored `padding: 0` on a `<ul>` would
 * round-trip away: Scamp parses it to `[0,0,0,0]`, the generator
 * sees that as matching the rectangle default, and omits the
 * declaration — the next browser render then re-applies the UA
 * `padding-inline-start: 40px` and the user's intent is lost.
 *
 * Scope is intentionally narrow:
 *   - **Padding** on `<ul>`, `<ol>`, `<dd>`: UA sets
 *     `padding-inline-start: 40px`, which in LTR maps to
 *     `padding-left: 40px`. This is a fixed px default (not
 *     em-based), so we can model it precisely.
 *   - **Margin** is deliberately NOT modelled here. UA margin
 *     defaults for `<p>`, `<h1>`–`<h6>`, `<ul>`, etc. are
 *     em-based and computed against the actual font-size, which
 *     can differ from Scamp's 16px assumption. Approximating
 *     them as px would cause canvas/browser drift. A separate,
 *     em-aware fix is the right path when this becomes a
 *     felt problem.
 */
export declare const TAG_PADDING_DEFAULTS: Record<string, readonly [number, number, number, number]>;
export declare const ZERO_PADDING: readonly [number, number, number, number];
/**
 * Effective padding default for an element of `tag`. Tags absent
 * from the override map use the universal `[0, 0, 0, 0]`.
 */
export declare const getTagDefaultPadding: (tag: string | undefined) => readonly [number, number, number, number];
/** Byte-equality on the four-tuple. */
export declare const paddingEquals: (a: readonly [number, number, number, number], b: readonly [number, number, number, number]) => boolean;
