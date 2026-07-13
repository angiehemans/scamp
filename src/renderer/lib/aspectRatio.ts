// Pure aspect-ratio math for the locked-resize feature (backlog-6 story 1).
// Kept out of the React components / hooks so the ratio arithmetic is
// fully unit-testable (see test/aspectRatio.test.ts). Lock state itself is
// session UI state in the canvas store; these helpers only compute sizes.
import { MIN_SIZE } from './bounds';
import { parseSizeValue } from './parsers';
import type { ScampElement } from './element';

/** Aspect ratio as width / height. Caller guards against a zero height. */
export const ratioOf = (width: number, height: number): number =>
  width / height;

/** Dependent height from a driving width + frozen ratio, floored at min. */
export const heightFromWidth = (
  width: number,
  ratio: number,
  min: number = MIN_SIZE
): number => Math.max(min, Math.round(width / ratio));

/** Dependent width from a driving height + frozen ratio, floored at min. */
export const widthFromHeight = (
  height: number,
  ratio: number,
  min: number = MIN_SIZE
): number => Math.max(min, Math.round(height * ratio));

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
export const lockedCornerResize = ({
  handle,
  originX,
  originY,
  originW,
  originH,
  dx,
  ratio,
  minSize = MIN_SIZE,
}: LockedCornerArgs): { x: number; y: number; w: number; h: number } => {
  const growingWest = handle === 'nw' || handle === 'sw';
  let w = Math.max(minSize, growingWest ? originW - dx : originW + dx);
  let h = w / ratio;
  // Keep both axes above the floor without breaking the ratio: if the
  // derived height underflows, pin height and back-compute width.
  if (h < minSize) {
    h = minSize;
    w = h * ratio;
  }
  const anchorEast = handle === 'nw' || handle === 'sw'; // opposite edge is east
  const anchorSouth = handle === 'nw' || handle === 'ne'; // opposite edge is south
  const x = anchorEast ? originX + (originW - w) : originX;
  const y = anchorSouth ? originY + (originH - h) : originY;
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  };
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
export const lockedSizePatch = (
  element: Pick<ScampElement, 'widthValue' | 'heightValue'>,
  axis: 'width' | 'height',
  raw: string,
  ratio: number | null
): Partial<ScampElement> => {
  const parsed = parseSizeValue(raw);
  if (axis === 'width') {
    if (parsed.mode !== 'fixed') {
      return {
        widthMode: parsed.mode,
        widthValue: element.widthValue,
        widthCustom: undefined,
      };
    }
    const patch: Partial<ScampElement> = {
      widthMode: 'fixed',
      widthValue: parsed.value,
      widthCustom: parsed.custom,
    };
    if (ratio !== null && parsed.custom === undefined) {
      patch.heightMode = 'fixed';
      patch.heightValue = heightFromWidth(parsed.value, ratio);
      patch.heightCustom = undefined;
    }
    return patch;
  }
  // axis === 'height'
  if (parsed.mode !== 'fixed') {
    return {
      heightMode: parsed.mode,
      heightValue: element.heightValue,
      heightCustom: undefined,
    };
  }
  const patch: Partial<ScampElement> = {
    heightMode: 'fixed',
    heightValue: parsed.value,
    heightCustom: parsed.custom,
  };
  if (ratio !== null && parsed.custom === undefined) {
    patch.widthMode = 'fixed';
    patch.widthValue = widthFromHeight(parsed.value, ratio);
    patch.widthCustom = undefined;
  }
  return patch;
};
