import type { ScampElement } from './element';
/**
 * Add `flex-shrink: 0` when the parent is a flex container.
 *
 * Grid parents are left alone: a grid item is sized by its track and an
 * explicit width is already honoured, so the declaration would be noise.
 *
 * An existing `flex-shrink` is never overwritten — if it is there, either
 * the user or the file it was parsed from meant it.
 */
export declare const preserveDrawnSize: (element: ScampElement, parent: ScampElement | undefined) => ScampElement;
/**
 * The counterpart of `preserveDrawnSize`: give the size BACK to the
 * layout when the user stops fixing it.
 *
 * `flex-shrink: 0` exists to keep a drawn box the size it was drawn.
 * The moment the user switches the parent's MAIN axis to a non-fixed
 * mode — fill, hug, auto — that reason is gone, and the leftover
 * declaration turns actively harmful: `width: 100%` with shrink 0 is
 * basis-100% that cannot shrink, so a "fill width" main panel renders
 * the full container width and overflows past its fixed-width sibling
 * by exactly the sibling's width.
 *
 * Only the main axis matters — flex-shrink has no effect on the cross
 * axis — and only the exact '0' the draw wrote is removed. Any other
 * value was authored deliberately and is left alone.
 */
export declare const releaseDrawnSize: (element: ScampElement, parent: ScampElement | undefined, patch: Partial<ScampElement>) => Partial<ScampElement>;
