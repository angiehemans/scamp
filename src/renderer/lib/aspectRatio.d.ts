import type { ScampElement } from './element';
/** Aspect ratio as width / height. Caller guards against a zero height. */
export declare const ratioOf: (width: number, height: number) => number;
/** Dependent height from a driving width + frozen ratio, floored at min. */
export declare const heightFromWidth: (width: number, ratio: number, min?: number) => number;
/** Dependent width from a driving height + frozen ratio, floored at min. */
export declare const widthFromHeight: (height: number, ratio: number, min?: number) => number;
export type CornerHandle = 'nw' | 'ne' | 'se' | 'sw';
type LockedCornerArgs = {
    handle: CornerHandle;
    originX: number;
    originY: number;
    originW: number;
    originH: number;
    /** Pointer delta on the x axis (logical px). Width is driven off this. */
    dx: number;
    ratio: number;
    minSize?: number;
};
/**
 * Proportional corner resize. Width is driven off the pointer's x delta
 * (the drive-off-width choice), height derived from the frozen ratio, and
 * the corner opposite the grabbed one stays anchored:
 *   - se → anchor top-left  (x, y fixed)
 *   - sw → anchor top-right (x follows)
 *   - ne → anchor bottom-left (y follows)
 *   - nw → anchor bottom-right (x and y follow)
 * Both dimensions are floored at `minSize` while preserving the ratio.
 */
export declare const lockedCornerResize: ({ handle, originX, originY, originW, originH, dx, ratio, minSize, }: LockedCornerArgs) => {
    x: number;
    y: number;
    w: number;
    h: number;
};
/**
 * Build a `patchElement` patch for a Size-panel W/H commit, applying the
 * aspect-ratio pairing when `ratio` is non-null. Replaces the old
 * per-axis `sizePatchForWidth` / `sizePatchForHeight` helpers.
 *
 * - Non-fixed input (auto / stretch / fit-content): the driving axis
 *   changes mode and keeps its stored value; NO pairing (a non-fixed axis
 *   can't be ratio-locked, and the caller drops the lock).
 * - Fixed plain-px input with a ratio: the paired axis is recomputed to
 *   fixed px so the two stay proportional.
 * - Fixed *custom* input (`100vh`, `calc(...)`): no pairing — a non-px
 *   length has no meaningful px ratio partner.
 */
export declare const lockedSizePatch: (element: Pick<ScampElement, "widthValue" | "heightValue">, axis: "width" | "height", raw: string, ratio: number | null) => Partial<ScampElement>;
export {};
