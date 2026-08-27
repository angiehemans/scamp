/**
 * Classify what a `background` value actually is, so the canvas can put it
 * on the right CSS property.
 *
 * `generateCode` writes the **shorthand** (`background: <value>`), which
 * happily takes a colour, a gradient, or an image. The canvas renders via
 * inline styles and deliberately uses longhands, so that a `background-image`
 * or `background-size` arriving through `customProperties` isn't wiped by a
 * competing shorthand. The bug that motivated this: the canvas put every
 * value on `backgroundColor`, and `background-color: radial-gradient(…)` is
 * invalid CSS — the browser drops it, so gradients rendered in the preview
 * and not on the canvas.
 *
 * The fix is to keep using longhands and pick the correct one.
 *
 * see docs/notes/canvas-gradient-backgrounds.md
 */
export type BackgroundKind = 
/** A plain colour — `#fff`, `rgb(…)`, `var(--accent)`, `transparent`. */
'color'
/** An image value — a gradient or `url(…)` — belongs on background-image. */
 | 'image'
/**
 * A layered/positioned shorthand (`url(x) center / cover no-repeat`) that
 * no single longhand expresses. Has to go on the shorthand.
 */
 | 'shorthand';
export declare const classifyBackgroundValue: (raw: string) => BackgroundKind;
/** Convenience: does this value belong on `background-image`? */
export declare const isImageBackground: (raw: string) => boolean;
