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
